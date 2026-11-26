/** Real Workflow and D1 checkpoints with model HTTP mocked. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { mockWordSupplyModel } from '../../../../test/wordSupplyModelMock';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM decrypto_word_packs'),
    env.DB.prepare('DELETE FROM decrypto_words'),
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    env.DB.prepare('UPDATE word_submission_agents SET current_credential_id = NULL'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare('DELETE FROM word_submission_daily_usage'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Decrypto supply workflow', () => {
  it('stores generated words as pending submissions without reviewing or publishing', async () => {
    const candidate = { word: '大象', potentialIssues: [] };
    const requests = mockWordSupplyModel(candidate, {
      word: candidate.word,
      reason: '常见且具体。',
      qualityChecks: {
        isFamiliar: true,
        isConcrete: true,
        isUnambiguous: true,
        isAppropriate: true,
      },
    });
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const runId = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DECRYPTO_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    await env.DECRYPTO_WORD_SUPPLY.create({
      id,
      params: { day, runId, category: 'general' },
    });

    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
    const pack = z
      .strictObject({
        category: z.string(),
        status: z.string(),
        generation_json: z.string(),
      })
      .parse(
        await env.DB.prepare(
          'SELECT category, status, generation_json FROM decrypto_word_packs WHERE id = ?',
        )
          .bind(`${day}-${runId}`)
          .first(),
      );
    expect(pack).toMatchObject({ category: 'general', status: 'reserved' });
    expect(JSON.parse(pack.generation_json)).toEqual({
      candidates: [{ ...candidate, category: 'general' }],
    });
    expect(
      await env.DB.prepare(
        `SELECT title, status FROM word_submission_items WHERE game = 'decrypto'`,
      ).first(),
    ).toEqual({ title: '大象', status: 'pending' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM decrypto_words').first()).toEqual({
      count: 0,
    });
    expect(requests).toHaveLength(1);
  });
});
