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
  it('stores actual generation material and publishes independently reviewed pairs', async () => {
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
    const requests = mockWordSupplyModel(candidateMaterial, review);
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
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
