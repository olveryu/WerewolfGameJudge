/** Real Workflow, provider and D1 checkpoints with model HTTP mocked. */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { mockWordSupplyModel } from '../../../../test/wordSupplyModelMock';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => vi.unstubAllGlobals());

describe('DrawGuess supply workflow', () => {
  it.each([
    { initialRequests: 6, force: false, expectedStatus: 'budget_exhausted' },
    { initialRequests: 8, force: true, expectedStatus: 'paused' },
  ])(
    'rechecks the budget between batches and honors force (force=$force)',
    async ({ initialRequests, force, expectedStatus }) => {
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
         INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
         SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
      )
        .bind(initialRequests, new Date().toISOString())
        .run();
      mockWordSupplyModel(
        { word: '大熊猫', difficulty: 'easy', potentialIssues: [] },
        {
          word: '大熊猫',
          qualityChecks: {
            isConcreteAndDrawable: true,
            isSimplifiedChinese: true,
            isLengthValid: true,
            isCategoryAccurate: true,
            isAppropriate: true,
            isUnambiguous: true,
          },
          reason: '模拟独立审核通过。',
        },
      );
      const id = crypto.randomUUID();
      await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
      await instance.modify(async (modifier) => {
        await modifier.disableSleeps();
        await modifier.mockStepResult({ name: 'enabled' }, true);
        await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
      });
      await env.DRAWGUESS_WORD_SUPPLY.create({
        id,
        params: { day: new Date().toISOString().slice(0, 10), force, runId: id },
      });
      await instance.waitForStatus('complete');
      expect(await instance.getOutput()).toEqual({ status: expectedStatus });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_word_packs').first(),
      ).toEqual({
        count: 1,
      });
    },
  );

  it('stops before reserving a pack when the shared budget is exhausted', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'budget_exhausted' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_word_packs').first(),
    ).toEqual({
      count: 0,
    });
  });

  it('stores actual generation material and publishes independently reviewed words', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const candidateMaterial = {
      word: '大熊猫',
      difficulty: 'easy',
      potentialIssues: [],
    };
    const review = {
      word: candidateMaterial.word,
      qualityChecks: {
        isConcreteAndDrawable: true,
        isSimplifiedChinese: true,
        isLengthValid: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isUnambiguous: true,
      },
      reason: '模拟独立审核通过。',
    };
    const requests = mockWordSupplyModel(candidateMaterial, review);
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    const pack = z
      .object({
        category: z.enum(DRAWGUESS_WORD_CATEGORIES),
        status: z.string(),
        generation_json: z.string(),
      })
      .parse(
        await env.DB.prepare(
          'SELECT category, status, generation_json FROM drawguess_word_packs WHERE id = ?',
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
      candidates: [{ word: candidateMaterial.word }],
    });
    expect(
      await env.DB.prepare(
        'SELECT word, category, pinyin_initials, status FROM drawguess_words',
      ).first(),
    ).toEqual({
      word: '大熊猫',
      category: pack.category,
      pinyin_initials: 'd x m',
      status: 'active',
    });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate-0' }, new Error('Provider unavailable'));
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM drawguess_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
  });
});
