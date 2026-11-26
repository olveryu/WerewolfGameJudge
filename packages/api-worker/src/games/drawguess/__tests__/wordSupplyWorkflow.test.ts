/** Real Workflow, provider and D1 checkpoints with model HTTP mocked. */
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { mockWordSupplyModel } from '../../../../test/wordSupplyModelMock';
import { getAiDiagnostic } from '../../../platform/ai/aiError';
import { getDrawGuessWordId } from '../wordEditorial';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    // The supply run leaves the system agent pointing at its credential:
    // clear the reference before deleting credentials, or the FK blocks
    // the cleanup.
    env.DB.prepare('UPDATE word_submission_agents SET current_credential_id = NULL'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    // Daily usage rows reference agents; delete them before the agents.
    env.DB.prepare('DELETE FROM word_submission_daily_usage'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DrawGuess supply workflow', () => {
  it('persists safe HTTP diagnostics while retaining failure bookkeeping and request count', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        {
          error: {
            status: 'UNAVAILABLE',
            message: `Model overloaded ${env.GEMINI_API_KEY}`,
            debug: 'private-provider-body',
          },
        },
        { status: 503, headers: { 'x-request-id': 'durable-provider-request' } },
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const diagRunId = crypto.randomUUID();
    const workflow = await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day, runId: diagRunId, category: 'animals' },
    });
    await instance.waitForStatus('errored');
    const status = await workflow.status();
    expect(status.error).toBeDefined();
    const persistedError = new Error(status.error?.message);
    expect(getAiDiagnostic(persistedError)).toMatchObject({
      game: 'drawguess',
      operation: 'generate',
      packId: `${day}-${diagRunId}`,
      attempt: 1,
      stage: 'http',
      httpStatus: 503,
      failureKind: 'serviceUnavailable',
      providerMessage: 'Model overloaded [REDACTED]',
      providerRequestId: 'durable-provider-request',
    });
    expect(persistedError.message).not.toContain(env.GEMINI_API_KEY);
    expect(persistedError.message).not.toContain('private-provider-body');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM drawguess_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });
  });

  it('runs even when the editorial log already holds requests and never touches existing submissions', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    // An already-pending submission waits for the manual review flow: the
    // workflow never reviews or publishes it.
    const day = new Date().toISOString().slice(0, 10);
    const sortedCategories = [...DRAWGUESS_WORD_CATEGORY_CATALOG.ids].sort();
    const category = sortedCategories[0];
    if (category === undefined) throw new Error('DrawGuess categories are empty');
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('existing-agent', 'Muse', '', '["drawguess"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('existing-batch', 'existing-agent', 'drawguess', 'existing-key', 'existing-hash', '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, status, duplicate_of, revision)
         VALUES ('30000000-0000-4000-8000-000000000001', 'existing-batch', 'drawguess', 'existing-item', ?,
           'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '大熊猫', ?,
           ?, 'pending', NULL, 0)`,
      ).bind(
        await getDrawGuessWordId('大熊猫'),
        category,
        JSON.stringify({
          word: '大熊猫',
          category,
          difficulty: 'easy',
          potentialIssues: [],
        }),
      ),
    ]);
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    candidates: [
                      {
                        word: '小猫',
                        category,
                        difficulty: 'easy',
                        potentialIssues: [],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchImpl);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day, runId: crypto.randomUUID(), category },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_word_packs').first(),
    ).toEqual({ count: 1 });
    expect(
      await env.DB.prepare(
        "SELECT title, status FROM word_submission_items WHERE title = '大熊猫'",
      ).first(),
    ).toEqual({ title: '大熊猫', status: 'pending' });
    expect(
      await env.DB.prepare(
        "SELECT title, status FROM word_submission_items WHERE title = '小猫'",
      ).first(),
    ).toEqual({ title: '小猫', status: 'pending' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 9 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('stores generated words as pending submissions and stops: no review, no publish', async () => {
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
    });
    const firstRunId = crypto.randomUUID();
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day, runId: firstRunId, category: 'animals' },
    });
    await instance.waitForStatus('complete');
    // Newly generated words stop as pending submissions: no review, no
    // publish, and the run ends with the stored count.
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
    const pack = z
      .object({
        category: z.enum(DRAWGUESS_WORD_CATEGORY_CATALOG.ids),
        status: z.string(),
        generation_json: z.string(),
      })
      .parse(
        await env.DB.prepare(
          'SELECT category, status, generation_json FROM drawguess_word_packs WHERE id = ?',
        )
          .bind(`${day}-${firstRunId}`)
          .first(),
      );
    expect(pack.status).toBe('reserved');
    expect(await instance.waitForStepResult({ name: 'generate' })).toMatchObject({
      candidates: [{ ...candidateMaterial, category: pack.category }],
      validation: { receivedCount: 1, validCount: 1, rejectedCount: 0, duplicateCount: 0 },
    });
    expect(JSON.parse(pack.generation_json)).toEqual({
      candidates: [{ ...candidateMaterial, category: pack.category }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ category: pack.category, history: [] });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT title, category, status FROM word_submission_items').first(),
    ).toEqual({ title: '大熊猫', category: pack.category, status: 'pending' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });

    // The next run generates new words and stores them the same way. Its
    // history is empty: history reads the candidate table, which supply no
    // longer writes — the first run's word lives in the submission queue,
    // and the ingestion dedup (not history) is what keeps a regenerated
    // duplicate out of the inventory.
    const resumeRequests = mockWordSupplyModel(
      { word: '小猫', difficulty: 'easy', potentialIssues: [] },
      review,
    );
    const resumeId = crypto.randomUUID();
    await using resume = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, resumeId);
    await resume.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const resumeRunId = crypto.randomUUID();
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id: resumeId,
      params: { day, runId: resumeRunId, category: 'animals' },
    });
    await resume.waitForStatus('complete');
    expect(await resume.getOutput()).toEqual({ status: 'complete', stored: 1 });
    expect(
      await env.DB.prepare('SELECT status FROM drawguess_word_packs WHERE id = ?')
        .bind(`${day}-${resumeRunId}`)
        .first(),
    ).toEqual({ status: 'reserved' });
    expect(resumeRequests).toHaveLength(1);
    expect(resumeRequests[0]).toMatchObject({ category: pack.category, history: [] });
    expect(
      (await env.DB.prepare('SELECT title, status FROM word_submission_items ORDER BY title').all())
        .results,
    ).toEqual([
      { title: '大熊猫', status: 'pending' },
      { title: '小猫', status: 'pending' },
    ]);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 2 });
  });

  it('lists inventory words of the category in generation history, including disabled ones', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const historyWordOf = (index: number) => `旧${String.fromCodePoint(0x4e00 + index)}`;
    // History reads the inventory, not only active words: every seeded word
    // is disabled, and the generated category's word must still appear.
    await env.DB.batch(
      DRAWGUESS_WORD_CATEGORY_CATALOG.ids.map((category, index) =>
        env.DB.prepare(
          `INSERT INTO drawguess_words
           (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
           VALUES (?, ?, 'x', ?, 'easy', 'disabled', ?, ?)`,
        ).bind(`history-${index}`, historyWordOf(index), category, day, day),
      ),
    );
    const requests = mockWordSupplyModel(
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
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day, runId: crypto.randomUUID(), category: 'animals' },
    });
    await instance.waitForStatus('complete');
    const generation = requests[0];
    expect(generation).toBeDefined();
    const categoryIndex = DRAWGUESS_WORD_CATEGORY_CATALOG.ids.findIndex(
      (category) => category === generation?.category,
    );
    expect(generation).toMatchObject({ history: [historyWordOf(categoryIndex)] });
  });

  it('fails all-rejected output with durable diagnostics, one report and no queue or review', async () => {
    const errorReport = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const candidate = { word: 'bad!', difficulty: 'easy', potentialIssues: [] };
    const requests = mockWordSupplyModel(candidate, {});
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
    });
    const diagRejectRunId = crypto.randomUUID();
    const workflow = await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: { day, runId: diagRejectRunId, category: 'animals' },
    });
    await instance.waitForStatus('errored');
    const status = await workflow.status();
    const diagnostic = getAiDiagnostic(new Error(status.error?.message));
    expect(diagnostic).toMatchObject({
      game: 'drawguess',
      operation: 'generate',
      packId: `${day}-${diagRejectRunId}`,
      stage: 'outputValidation',
      failureKind: 'invalidOutput',
      validationCode: 'allCandidatesRejected',
      validationSummary: {
        receivedCount: 1,
        validCount: 0,
        rejectedCount: 1,
        duplicateCount: 0,
        omittedIssueCount: 0,
        rejectionSamples: [
          {
            index: 0,
            path: ['candidates', 0, 'word'],
            code: 'invalid_format',
          },
        ],
      },
    });
    expect(requests).toHaveLength(1);
    expect(errorReport).toHaveBeenCalledOnce();
    expect(JSON.stringify(errorReport.mock.calls)).not.toContain('bad!');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM drawguess_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
    ).toEqual({ count: 0 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });
  });

  it('records failed generation without publishing or automatically repeating the operation', async () => {
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.DRAWGUESS_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'generate' }, new Error('Provider unavailable'));
    });
    await env.DRAWGUESS_WORD_SUPPLY.create({
      id,
      params: {
        day: new Date().toISOString().slice(0, 10),
        runId: crypto.randomUUID(),
        category: 'animals',
      },
    });
    await instance.waitForStatus('errored');
    expect(
      await env.DB.prepare('SELECT status, failure_reason FROM drawguess_word_packs').first(),
    ).toEqual({ status: 'failed', failure_reason: 'generation' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
    ).toEqual({ count: 0 });
  });
});
