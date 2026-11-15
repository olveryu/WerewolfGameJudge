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
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    // The FTS search row is keyed by the batch rowid: batches are deleted
    // above, so the next store reuses the rowid and must not collide with
    // the leftover search row.
    env.DB.prepare('DELETE FROM word_submission_search'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => vi.unstubAllGlobals());

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

describe('Undercover supply workflow', () => {
  it('runs even when the editorial log already holds requests: there is no budget', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    mockWordSupplyModel(candidateMaterial, review);
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day, runId: crypto.randomUUID() } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_packs').first(),
    ).toEqual({ count: 1 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM word_submission_items WHERE status = 'pending'",
      ).first(),
    ).toEqual({ count: 1 });
  });

  it('stores generated pairs as pending submissions and stops: no review, no publish', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const requests = mockWordSupplyModel(candidateMaterial, review);
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const firstRunId = crypto.randomUUID();
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day, runId: firstRunId } });
    await instance.waitForStatus('complete');
    // Newly generated pairs stop as pending submissions: no review, no
    // publish, and the run ends with the stored count.
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
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
          .bind(`${day}-${firstRunId}`)
          .first(),
      );
    expect(pack.status).toBe('reserved');
    expect(JSON.parse(pack.generation_json)).toEqual({
      candidates: [{ ...candidateMaterial, category: pack.category }],
    });
    expect(await instance.waitForStepResult({ name: 'generate' })).toMatchObject({
      validation: { receivedCount: 1, validCount: 1, rejectedCount: 0, duplicateCount: 0 },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ category: pack.category, history: [] });
    expect(
      await env.DB.prepare('SELECT title, category, status FROM word_submission_items').first(),
    ).toEqual({ title: '熬夜 / 赖床', category: pack.category, status: 'pending' });
    expect(
      await env.DB.prepare(
        'SELECT word_a, word_b, category, status FROM undercover_word_pairs',
      ).first(),
    ).toBeNull();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });

    // The next run generates new pairs and stores them the same way. Its
    // history is empty: history reads the published pairs, and nothing is
    // published yet — the first run's pair lives in the submission queue,
    // and the ingestion dedup (not history) is what keeps a regenerated
    // duplicate out of the inventory.
    const resumeRequests = mockWordSupplyModel(
      {
        wordA: '早起',
        wordB: '晚睡',
        commonTraits: ['作息习惯', '感觉困倦'],
        differences: ['发生时间', '是否入睡'],
        potentialIssues: [],
      },
      review,
    );
    const resumeId = crypto.randomUUID();
    await using resume = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, resumeId);
    await resume.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const resumeRunId = crypto.randomUUID();
    await env.UNDERCOVER_WORD_SUPPLY.create({ id: resumeId, params: { day, runId: resumeRunId } });
    await resume.waitForStatus('complete');
    expect(await resume.getOutput()).toEqual({ status: 'complete', stored: 1 });
    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_packs WHERE id = ?')
        .bind(`${day}-${resumeRunId}`)
        .first(),
    ).toEqual({ status: 'reserved' });
    expect(resumeRequests).toHaveLength(1);
    expect(resumeRequests[0]).toMatchObject({ category: pack.category, history: [] });
    expect(
      (await env.DB.prepare('SELECT title, status FROM word_submission_items ORDER BY title').all())
        .results,
    ).toEqual([
      { title: '早起 / 晚睡', status: 'pending' },
      { title: '熬夜 / 赖床', status: 'pending' },
    ]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 2 });
  });

  it('fails the pack instead of storing anything when every generated candidate is rejected', async () => {
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    // The returned candidate is invalid (too-short traits), so the parsed
    // count is 0. Generation throws allCandidatesRejected before the store
    // step, so the run must fail here — never report a stored count with
    // nothing new stored, and never burn another generation round on the
    // same pack.
    const requests = mockWordSupplyModel(
      { ...candidateMaterial, commonTraits: ['不足'] },
      // No candidate reaches review, so no review payload is ever requested.
      {},
    );
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const rejectRunId = crypto.randomUUID();
    await env.UNDERCOVER_WORD_SUPPLY.create({ id, params: { day, runId: rejectRunId } });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM undercover_word_packs WHERE id = ?')
        .bind(`${day}-${rejectRunId}`)
        .first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
    expect(requests).toHaveLength(1);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.UNDERCOVER_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate' }, new Error('Provider unavailable'));
    });
    await env.UNDERCOVER_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10), runId: crypto.randomUUID() },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM undercover_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
    ).toEqual({ count: 0 });
  });
});
