/** Real Workflow, provider and D1 checkpoints with model HTTP mocked. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { mockWordSupplyModel } from '../../../../test/wordSupplyModelMock';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM undercover_round_word_selections'),
    env.DB.prepare('DELETE FROM undercover_word_candidates'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => vi.unstubAllGlobals());

describe('Undercover supply workflow', () => {
  it('stops before reserving a pack when the shared budget is exhausted', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'budget_exhausted' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_packs').first(),
    ).toEqual({
      count: 0,
    });
  });

  it('checkpoints partial validation and publishes only valid independently reviewed pairs', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const candidateMaterial = {
      wordA: '熬夜',
      wordB: '赖床',
      commonTraits: ['作息习惯', '感觉困倦'],
      differences: ['发生时间', '是否入睡'],
      potentialIssues: [],
    };
    const review = {
      wordA: candidateMaterial.wordA,
      wordB: candidateMaterial.wordB,
      commonTraits: ['影响精神', '影响作息'],
      differences: ['早上晚上', '睡醒睡前'],
      reason: '模拟独立审核通过。',
      qualityChecks: {
        isFamiliar: true,
        hasSimilarFamiliarity: true,
        hasSharedDescriptions: true,
        hasDistinctDescriptions: true,
        isNotSynonymOrSubset: true,
        isPlayableBothWays: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isFactuallyCertain: true,
      },
    };
    const requests = mockWordSupplyModel(
      [
        { ...candidateMaterial, commonTraits: ['不足'] },
        { ...candidateMaterial, wordB: candidateMaterial.wordA },
        candidateMaterial,
        { ...candidateMaterial, wordA: candidateMaterial.wordB, wordB: candidateMaterial.wordA },
      ],
      review,
    );
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(await instance.waitForStepResult({ name: 'generate-0' })).toMatchObject({
      validation: { receivedCount: 4, validCount: 1, rejectedCount: 2, duplicateCount: 1 },
    });
    const pack = z
      .object({
        category: z.enum(UNDERCOVER_CATEGORIES),
        status: z.string(),
        generation_json: z.string(),
      })
      .parse(
        await env.DB.prepare(
          'SELECT category, status, generation_json FROM undercover_word_packs WHERE id = ?',
        )
          .bind(`${day}-0`)
          .first(),
      );
    expect(pack.status).toBe('published');
    expect(JSON.parse(pack.generation_json)).toEqual({
      candidates: [{ ...candidateMaterial, category: pack.category }],
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ category: pack.category, history: [] });
    expect(requests[1]).toMatchObject({
      category: pack.category,
      candidates: [{ wordA: candidateMaterial.wordA, wordB: candidateMaterial.wordB }],
    });
    expect(
      await env.DB.prepare(
        'SELECT word_a, word_b, category, status FROM undercover_word_pairs',
      ).first(),
    ).toEqual({
      word_a: '熬夜',
      word_b: '赖床',
      category: pack.category,
      status: 'active',
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 2 });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate-0' }, new Error('Provider unavailable'));
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM undercover_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
  });
});
