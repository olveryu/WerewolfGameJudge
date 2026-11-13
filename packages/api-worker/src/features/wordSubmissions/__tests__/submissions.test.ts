/** Real D1, HTTP authorization, durable review, and atomic publication boundaries. */
import {
  type WordSubmissionAction,
  wordSubmissionBatchSchema,
  type WordSubmissionInput,
  wordSubmissionValidationSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { env, introspectWorkflowInstance, SELF } from 'cloudflare:test';
import { NonRetryableError } from 'cloudflare:workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { sha256Hex } from '../../../platform/crypto/sha256Hex';
import {
  authenticateSubmissionToken,
  createSubmissionAgent,
  rotateSubmissionCredential,
  setSubmissionAgentStatus,
} from '../credentials';
import { storeSubmission, validateSubmission } from '../ingestion';
import { applySubmissionAction } from '../operations';
import { listSubmissionBatches, readSubmissionBatch } from '../repository';
import { readSubmissionSettings } from '../settings';

const candidate = {
  word: '大熊猫',
  category: 'animals',
  difficulty: 'easy',
  potentialIssues: [],
};
const payload: WordSubmissionInput = {
  schemaVersion: 1,
  game: 'drawguess',
  items: [{ clientItemId: 'panda', content: candidate }],
};
const checks = {
  isConcreteAndDrawable: true,
  isSimplifiedChinese: true,
  isLengthValid: true,
  isCategoryAccurate: true,
  isAppropriate: true,
  isUnambiguous: true,
};
async function agent(dailyQuota = 100, pendingQuota = 100) {
  return createSubmissionAgent(env.DB, {
    name: 'Personal agent',
    description: 'Test fixture',
    games: ['drawguess', 'undercover', 'fibking'],
    dailyQuota,
    pendingQuota,
    expiresInDays: 30,
  });
}
function request(path: string, token: string, body?: unknown, key = crypto.randomUUID()) {
  return SELF.fetch(`https://test.invalid${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      'CF-Connecting-IP': '127.0.0.1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function submit(token: string, input = payload, key?: string) {
  const response = await request('/v1/word-submissions', token, input, key);
  expect(response.status).toBe(202);
  return wordSubmissionBatchSchema.parse(await response.json());
}
function action(
  batch: Awaited<ReturnType<typeof submit>>,
  kind: WordSubmissionAction['action'],
  reason = '',
  id = crypto.randomUUID(),
): WordSubmissionAction {
  return {
    id,
    action: kind,
    reason,
    items: batch.items.map((item) => ({
      id: item.id,
      contentHash: item.contentHash,
      revision: item.revision,
    })),
  };
}
function modelReview(passed = true, words = [candidate.word]) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reviews: words.map((word) => ({
                      word,
                      qualityChecks: { ...checks, isConcreteAndDrawable: passed },
                      reason: passed ? '外形明确，适合绘画猜词。' : '不适合本次题库。',
                    })),
                  }),
                },
              ],
            },
          },
        ],
      }),
    ),
  );
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_search'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare('DELETE FROM word_submission_daily_usage'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
    env.DB.prepare('DELETE FROM word_submission_evidence_requests'),
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare(`UPDATE word_submission_limits SET accepting = 1, pending_count = 0,
      submitted_today = 0, submission_day = '', awaiting_review_count = 0,
      awaiting_publication_count = 0, failed_count = 0, published_count = 0 WHERE id = 1`),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
  ]);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected provider HTTP')));
});
afterEach(() => vi.unstubAllGlobals());

describe('External word submissions', () => {
  it('authenticates separate scopes and never stores or returns raw tokens on reads', async () => {
    const issued = await agent();
    expect(await (await request('/v1/word-submission-spec', issued.token)).json()).toMatchObject({
      schemaVersion: 1,
      allowedGames: ['drawguess', 'undercover', 'fibking'],
    });
    expect((await request('/v1/word-submission-spec', env.ADMIN_PASSWORD)).status).toBe(401);
    expect((await request('/admin/word-submissions/agents', issued.token)).status).toBe(401);
    const stored = await env.DB.prepare(
      'SELECT token_hash, prefix FROM word_submission_credentials',
    ).first();
    expect(stored).toEqual({
      token_hash: await sha256Hex(issued.token),
      prefix: issued.token.slice(0, 12),
    });
    const read = await SELF.fetch('https://test.invalid/admin/word-submissions/agents', {
      headers: { 'X-Admin-Token': env.ADMIN_PASSWORD },
    });
    expect(await read.text()).not.toContain(issued.token);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces game scope, expiry, revocation, and owner-only results', async () => {
    const first = await agent();
    const batch = await submit(first.token);
    const second = await createSubmissionAgent(env.DB, {
      name: 'Other',
      description: '',
      games: ['undercover'],
      dailyQuota: 10,
      pendingQuota: 10,
      expiresInDays: 30,
    });
    expect((await request('/v1/word-submissions', second.token, payload)).status).toBe(403);
    expect((await request(`/v1/word-submissions/${batch.id}`, second.token)).status).toBe(404);
    await env.DB.prepare(
      "UPDATE word_submission_credentials SET expires_at = '2000-01-01T00:00:00.000Z' WHERE agent_id = ?",
    )
      .bind(first.agent.id)
      .run();
    expect((await request('/v1/word-submission-spec', first.token)).status).toBe(401);
    await env.DB.prepare("UPDATE word_submission_agents SET status = 'revoked' WHERE id = ?")
      .bind(second.agent.id)
      .run();
    expect((await request('/v1/word-submission-spec', second.token)).status).toBe(403);
  });

  it('audits credential lifecycle and intake changes transactionally without recording raw secrets', async () => {
    const issued = await agent();
    const replacement = await rotateSubmissionCredential(env.DB, issued.agent.id, 30);
    await setSubmissionAgentStatus(env.DB, issued.agent.id, 'paused');
    await setSubmissionAgentStatus(env.DB, issued.agent.id, 'active');
    await setSubmissionAgentStatus(env.DB, issued.agent.id, 'revoked');
    const response = await SELF.fetch('https://test.invalid/admin/word-submissions/settings', {
      method: 'POST',
      headers: { 'X-Admin-Token': env.ADMIN_PASSWORD, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepting: false }),
    });
    expect(response.status).toBe(200);
    const audit = await env.DB.prepare(
      'SELECT action, actor, details_json FROM word_submission_control_events ORDER BY id',
    ).all();
    expect(audit.results.map((entry) => entry.action)).toEqual([
      'agent_created',
      'credential_issued',
      'credential_issued',
      'agent_status_changed',
      'agent_status_changed',
      'agent_status_changed',
      'intake_changed',
    ]);
    expect(audit.results.every((entry) => entry.actor === 'shared-admin')).toBe(true);
    expect(JSON.stringify(audit.results)).not.toContain(issued.token);
    expect(JSON.stringify(audit.results)).not.toContain(replacement.token);
    expect((await request('/v1/word-submission-spec', replacement.token)).status).toBe(403);
  });

  it('replays a batch without another quota charge and rejects a changed payload for the same key', async () => {
    const issued = await agent(1, 1);
    const key = crypto.randomUUID();
    const batch = await submit(issued.token, payload, key);
    const replay = await submit(issued.token, payload, key);
    expect(replay).toEqual(batch);
    const changed = {
      ...payload,
      items: [{ clientItemId: 'other', content: { ...candidate, word: '长颈鹿' } }],
    };
    expect((await request('/v1/word-submissions', issued.token, changed, key)).status).toBe(409);
    expect(
      await env.DB.prepare('SELECT submitted_count FROM word_submission_daily_usage').first(),
    ).toEqual({ submitted_count: 1 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serializes competing quota claims and preserves quota across credential replacement', async () => {
    const issued = await agent(1, 1);
    const responses = await Promise.all([
      request('/v1/word-submissions', issued.token, payload),
      request('/v1/word-submissions', issued.token, payload),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([202, 429]);
    const replacement = await rotateSubmissionCredential(env.DB, issued.agent.id, 30);
    expect((await request('/v1/word-submission-spec', issued.token)).status).toBe(401);
    expect((await request('/v1/word-submissions', replacement.token, payload)).status).toBe(429);
    expect(
      await env.DB.prepare(
        'SELECT pending_count, submitted_today FROM word_submission_limits',
      ).first(),
    ).toEqual({ pending_count: 1, submitted_today: 1 });
  });

  it('coalesces concurrent exact submissions into one batch and one quota charge', async () => {
    const issued = await agent(1, 1);
    const key = crypto.randomUUID();
    const responses = await Promise.all([
      submit(issued.token, payload, key),
      submit(issued.token, payload, key),
    ]);
    expect(responses[0]).toEqual(responses[1]);
    expect(
      await env.DB.prepare(
        'SELECT submitted_today, pending_count FROM word_submission_limits',
      ).first(),
    ).toEqual({ submitted_today: 1, pending_count: 1 });
    expect(
      await env.DB.prepare(
        `SELECT
      (SELECT COUNT(*) FROM drawguess_word_candidates) +
      (SELECT COUNT(*) FROM undercover_word_candidates) +
      (SELECT COUNT(*) FROM fib_word_candidate_reviews) AS count`,
      ).first(),
    ).toEqual({ count: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechecks paused or expired authorization inside the quota transaction', async () => {
    const issued = await agent();
    const principal = await authenticateSubmissionToken(env.DB, `Bearer ${issued.token}`);
    const validated = await validateSubmission(env.DB, payload, principal);
    await env.DB.prepare("UPDATE word_submission_agents SET status = 'paused' WHERE id = ?")
      .bind(issued.agent.id)
      .run();
    await expect(
      storeSubmission(env.DB, payload, principal, crypto.randomUUID(), 'hash', validated.items),
    ).rejects.toThrow('SUBMISSION_AGENT_NOT_ACTIVE');
    await env.DB.prepare("UPDATE word_submission_agents SET status = 'active' WHERE id = ?")
      .bind(issued.agent.id)
      .run();
    await env.DB.prepare(
      "UPDATE word_submission_credentials SET expires_at = '2000-01-01T00:00:00.000Z' WHERE agent_id = ?",
    )
      .bind(issued.agent.id)
      .run();
    await expect(
      storeSubmission(env.DB, payload, principal, crypto.randomUUID(), 'hash', validated.items),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_batches').first(),
    ).toEqual({ count: 0 });
    expect((await readSubmissionSettings(env.DB)).submittedToday).toBe(0);
  });

  it('charges duplicates toward the exact 1000-item global daily ceiling across principals', async () => {
    const issued = await agent(1000, 1000);
    const items = Array.from({ length: 30 }, (_, index) => ({
      clientItemId: `item-${index}`,
      content: candidate,
    }));
    for (let index = 0; index < 33; index++) await submit(issued.token, { ...payload, items });
    await submit(issued.token, { ...payload, items: items.slice(0, 10) });
    expect(await readSubmissionSettings(env.DB)).toMatchObject({
      submittedToday: 1000,
      pending: 1,
    });
    const other = await agent(1000, 1000);
    expect((await request('/v1/word-submissions', other.token, payload)).status).toBe(429);
    expect((await readSubmissionSettings(env.DB)).submittedToday).toBe(1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces the exact 5000-item global unresolved ceiling and releases capacity on dismissal', async () => {
    for (let index = 0; index < 5; index++) {
      const historical = await agent(1000, 1000);
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO word_submission_batches
        (id, agent_id, game, idempotency_key, request_hash, created_at)
        VALUES (?, ?, 'drawguess', ?, 'historical', '2020-01-01T00:00:00.000Z')`,
      )
        .bind(id, historical.agent.id, id)
        .run();
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (
        SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?
      ) INSERT INTO word_submission_items
        (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status)
        SELECT ? || ':' || i, ?, 'drawguess', 'item-' || i, 'historical-' || (? + i),
          printf('%064x', ? + i), '历史词语', 'animals', '{}', 'pending' FROM n`,
      )
        .bind(index === 4 ? 999 : 1000, id, id, index * 1000, index * 1000)
        .run();
    }
    const issued = await agent();
    const batch = await submit(issued.token);
    expect((await readSubmissionSettings(env.DB)).pending).toBe(5000);
    const fresh = {
      ...payload,
      items: [{ clientItemId: 'other', content: { ...candidate, word: '长颈鹿' } }],
    };
    expect((await request('/v1/word-submissions', issued.token, fresh)).status).toBe(429);
    await applySubmissionAction(env, batch.id, action(batch, 'dismiss', '关闭候选释放容量'));
    await submit(issued.token, fresh);
    expect((await readSubmissionSettings(env.DB)).pending).toBe(5000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('separates invalid content from provider failures and bounds request bytes', async () => {
    const issued = await agent();
    const invalid = {
      ...payload,
      items: [{ clientItemId: 'bad', content: { ...candidate, word: '<script>' } }],
    };
    const validation = await request('/v1/word-submissions/validate', issued.token, invalid);
    expect(validation.status).toBe(200);
    expect(await validation.json()).toMatchObject({ items: [{ status: 'invalid' }] });
    expect((await request('/v1/word-submissions', issued.token, invalid)).status).toBe(422);
    const invalidInitials = {
      ...payload,
      items: [{ clientItemId: 'vowel', content: { ...candidate, word: '企鹅' } }],
    };
    const invalidInitialsResult = wordSubmissionValidationSchema.parse(
      await (await request('/v1/word-submissions/validate', issued.token, invalidInitials)).json(),
    );
    expect(invalidInitialsResult.items?.[0]?.status).toBe('invalid');
    expect(invalidInitialsResult.items?.[0]?.reason).toContain('拼音首字母');
    expect((await request('/v1/word-submissions', issued.token, invalidInitials)).status).toBe(422);
    expect(
      (await request('/v1/word-submissions', issued.token, { ...payload, unknown: true })).status,
    ).toBe(400);
    const large = { ...payload, padding: 'x'.repeat(128 * 1024) };
    expect((await request('/v1/word-submissions', issued.token, large)).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('canonicalizes reversed pairs and deduplicates content across agents without revealing the owner', async () => {
    const issued = await agent();
    const pair = {
      wordA: '牛奶',
      wordB: '豆浆',
      category: 'food',
      commonTraits: ['可以饮用', '早餐常见'],
      differences: ['主要原料不同', '来源不同'],
      potentialIssues: [],
    };
    const input: WordSubmissionInput = {
      schemaVersion: 1,
      game: 'undercover',
      items: [{ clientItemId: 'pair', content: pair }],
    };
    const first = await submit(issued.token, input);
    const other = await agent();
    const duplicate = await submit(other.token, {
      ...input,
      items: [
        { clientItemId: 'reverse', content: { ...pair, wordA: pair.wordB, wordB: pair.wordA } },
      ],
    });
    expect(first.items[0]?.status).toBe('pending');
    expect(duplicate.items[0]?.status).toBe('duplicate');
    expect(duplicate.items[0]?.duplicateOf).toBe('previous-submission');
    expect(JSON.stringify(duplicate)).not.toContain(issued.agent.id);
  });

  it('pauses new intake without blocking exact replays or reading existing submissions', async () => {
    const issued = await agent();
    const key = crypto.randomUUID();
    const batch = await submit(issued.token, payload, key);
    await env.DB.prepare('UPDATE word_submission_limits SET accepting = 0 WHERE id = 1').run();
    expect((await request('/v1/word-submissions', issued.token, payload)).status).toBe(503);
    expect((await submit(issued.token, payload, key)).id).toBe(batch.id);
    expect((await request(`/v1/word-submissions/${batch.id}`, issued.token)).status).toBe(200);
  });

  it('reviews without publishing, then publishes atomically and retires without deleting seen history', async () => {
    const issued = await agent();
    const batch = await submit(issued.token);
    const id = crypto.randomUUID();
    modelReview();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('complete');
    const reviewed = await readSubmissionBatch(env.DB, batch.id);
    expect(reviewed.items[0]?.status).toBe('passed');
    expect(fetch).toHaveBeenCalledOnce();
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    const publish = action(reviewed, 'publish');
    await Promise.all([
      applySubmissionAction(env, batch.id, publish),
      applySubmissionAction(env, batch.id, publish),
    ]);
    const inventory = await env.DB.prepare(
      'SELECT id, draw_ordinal, status FROM drawguess_words',
    ).first<{ id: string; draw_ordinal: number; status: string }>();
    expect(inventory?.status).toBe('active');
    expect(inventory?.draw_ordinal).toBeGreaterThan(0);
    await env.DB.prepare("INSERT INTO users (id) VALUES ('submission-reader')").run();
    await env.DB.prepare(
      "INSERT INTO word_seen (user_id, pool, seen) VALUES ('submission-reader', 'drawguess', ?)",
    )
      .bind(`,${inventory?.draw_ordinal},`)
      .run();
    const published = await readSubmissionBatch(env.DB, batch.id);
    await applySubmissionAction(
      env,
      batch.id,
      action(published, 'unpublish', '测试下架，保留编号和已见历史。'),
    );
    expect(
      await env.DB.prepare('SELECT id, draw_ordinal, status FROM drawguess_words').first(),
    ).toEqual({ ...inventory, status: 'disabled' });
    expect(
      await env.DB.prepare(
        "SELECT seen FROM word_seen WHERE user_id = 'submission-reader'",
      ).first(),
    ).toEqual({ seen: `,${inventory?.draw_ordinal},` });
    expect(
      await env.DB.prepare(
        "SELECT members FROM word_draw_index WHERE pool = 'drawguess' AND partition_key = 'all'",
      ).first(),
    ).toEqual({ members: ',' });
    expect(await readSubmissionSettings(env.DB)).toMatchObject({
      pending: 0,
      awaitingReview: 0,
      awaitingPublication: 0,
      failed: 0,
      published: 0,
    });
  });

  it('rejects an entire stale publication selection without publishing its still-eligible items', async () => {
    const issued = await agent();
    const batch = await submit(issued.token, {
      ...payload,
      items: [
        ...payload.items,
        { clientItemId: 'giraffe', content: { ...candidate, word: '长颈鹿' } },
      ],
    });
    const id = crypto.randomUUID();
    modelReview(true, [candidate.word, '长颈鹿']);
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('complete');
    const reviewed = await readSubmissionBatch(env.DB, batch.id);
    await applySubmissionAction(
      env,
      batch.id,
      action(
        {
          ...reviewed,
          items: reviewed.items.slice(0, 1),
        },
        'dismiss',
        '已核对，关闭此候选',
      ),
    );
    await expect(applySubmissionAction(env, batch.id, action(reviewed, 'publish'))).rejects.toThrow(
      'SUBMISSION_SELECTION_STALE',
    );
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    const valid = await readSubmissionBatch(env.DB, batch.id);
    const onlyPassed = { ...valid, items: valid.items.filter((item) => item.status === 'passed') };
    const results = await Promise.allSettled([
      applySubmissionAction(env, batch.id, action(onlyPassed, 'publish')),
      applySubmissionAction(env, batch.id, action(onlyPassed, 'publish')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 1,
    });
    expect((await listSubmissionBatches(env.DB, { status: 'passed' })).batches).toEqual([]);
    expect((await listSubmissionBatches(env.DB, { status: 'published' })).batches[0]?.id).toBe(
      batch.id,
    );
  });

  it.each([
    { period: 'daily', count: 7, age: 0, limit: 8 },
    { period: 'monthly', count: 119, age: 2, limit: 120 },
  ])(
    'stops at the exact shared $period model ceiling, including automatic supply claims',
    async ({ count, age, limit }) => {
      const issued = await agent();
      const batch = await submit(issued.token);
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (
      SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?
    ) INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
      SELECT 'automatic-' || i, 'undercover', 'test-model', ? FROM n`,
      )
        .bind(count, new Date(Date.now() - age * 86_400_000).toISOString())
        .run();
      const id = crypto.randomUUID();
      modelReview();
      await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
      await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
      await instance.waitForStatus('complete');
      const reviewed = await readSubmissionBatch(env.DB, batch.id);
      await expect(
        applySubmissionAction(env, batch.id, action(reviewed, 'review')),
      ).rejects.toThrow('EDITORIAL_MODEL_BUDGET_EXHAUSTED');
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
      ).toEqual({ count: limit });
      expect(fetch).toHaveBeenCalledOnce();
      await applySubmissionAction(env, batch.id, action(reviewed, 'publish'));
      expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.status).toBe('published');
    },
  );

  it('reviews and publishes Undercover through its game-owned canonical identity and stable draw index', async () => {
    const issued = await agent();
    const pair = {
      wordA: '牛奶',
      wordB: '豆浆',
      category: 'food',
      commonTraits: ['可以饮用', '早餐常见'],
      differences: ['主要原料不同', '来源不同'],
      potentialIssues: [],
    };
    const batch = await submit(issued.token, {
      schemaVersion: 1,
      game: 'undercover',
      items: [{ clientItemId: 'pair', content: pair }],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () =>
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reviews: [
                        {
                          wordA: pair.wordA,
                          wordB: pair.wordB,
                          commonTraits: pair.commonTraits,
                          differences: pair.differences,
                          reason: '双方均有共同描述和清晰差异。',
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
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('complete');
    const reviewed = await readSubmissionBatch(env.DB, batch.id);
    expect(reviewed.items[0]?.status).toBe('passed');
    await applySubmissionAction(env, batch.id, action(reviewed, 'publish'));
    const inventory = await env.DB.prepare(
      'SELECT id, draw_ordinal, status FROM undercover_word_pairs',
    ).first<{ id: string; draw_ordinal: number; status: string }>();
    expect(inventory).toMatchObject({ id: reviewed.items[0]?.identity, status: 'active' });
    expect(inventory?.draw_ordinal).toBeGreaterThan(0);
    await applySubmissionAction(
      env,
      batch.id,
      action(await readSubmissionBatch(env.DB, batch.id), 'unpublish', '保留编号下架'),
    );
    expect(
      await env.DB.prepare('SELECT id, draw_ordinal, status FROM undercover_word_pairs').first(),
    ).toEqual({ ...inventory, status: 'disabled' });
  });

  it('retrieves Fib evidence independently, ignores agent URLs, and publishes only after separate human confirmation', async () => {
    const issued = await agent();
    const definition = {
      coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
      usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
    };
    const batch = await submit(issued.token, {
      schemaVersion: 1,
      game: 'fibking',
      items: [
        {
          clientItemId: 'lotus',
          content: {
            word: '菡萏',
            category: 'literary',
            topic: 'plants',
            definition,
            references: [{ url: 'http://127.0.0.1/private', note: 'untrusted' }],
          },
        },
      ],
    });
    const url = 'https://dictionary.example/lotus';
    const proof = `菡萏：${definition.coreMeaning}`;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const target =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (target === 'https://api.tavily.com/search')
          return Response.json({
            results: [{ url, title: '独立词典', content: proof }],
            usage: { credits: 1 },
          });
        if (target === 'https://api.tavily.com/extract') {
          expect(typeof init?.body).toBe('string');
          if (typeof init?.body !== 'string') throw new Error('Expected serialized Tavily request');
          const extraction: unknown = JSON.parse(init.body);
          expect(extraction).toMatchObject({ urls: [url] });
          return Response.json({
            results: [{ url, raw_content: proof }],
            failed_results: [],
            usage: { credits: 1 },
          });
        }
        if (!target.startsWith('https://generativelanguage.googleapis.com/'))
          throw new Error('Unapproved provider URL');
        return Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  reviews: [
                    {
                      word: '菡萏',
                      reason: '证据支持，释义准确且有揭晓价值。',
                      qualityChecks: {
                        isEstablishedTerm: true,
                        isDefinitionAccurate: true,
                        isMeaningUnfamiliarToMostPlayers: true,
                        isMeaningDistinctFromLiteralReading: true,
                        hasMultiplePlausibleWrongDefinitions: true,
                        hasRevealValue: true,
                      },
                      evidenceIndex: 0,
                      evidenceQuote: 'source0quote0',
                    },
                  ],
                }),
              },
            },
          ],
        });
      }),
    );
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('complete');
    const reviewed = await readSubmissionBatch(env.DB, batch.id);
    expect(reviewed.items[0]).toMatchObject({
      status: 'passed',
      review: { canOverride: true, passed: true },
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM word_submission_evidence_requests',
      ).first(),
    ).toEqual({ count: 2 });
    expect(fetch).toHaveBeenCalledTimes(3);
    await applySubmissionAction(env, batch.id, action(reviewed, 'publish'));
    expect(await env.DB.prepare('SELECT word, status FROM fib_words').first()).toEqual({
      word: '菡萏',
      status: 'active',
    });
    const sequence = await env.DB.prepare('SELECT * FROM fib_word_sequence WHERE word = ?')
      .bind('菡萏')
      .first();
    expect(sequence).not.toBeNull();
    await applySubmissionAction(
      env,
      batch.id,
      action(await readSubmissionBatch(env.DB, batch.id), 'unpublish', '保留已见历史下架'),
    );
    expect(
      await env.DB.prepare('SELECT * FROM fib_word_sequence WHERE word = ?').bind('菡萏').first(),
    ).toEqual(sequence);
    expect(
      await env.DB.prepare('SELECT status FROM fib_words WHERE word = ?').bind('菡萏').first(),
    ).toEqual({ status: 'disabled' });
  });

  it('stops independent evidence at exactly 454 monthly claims without extraction or model retries', async () => {
    const issued = await agent();
    const batch = await submit(issued.token, {
      schemaVersion: 1,
      game: 'fibking',
      items: [
        {
          clientItemId: 'lotus',
          content: {
            word: '菡萏',
            category: 'literary',
            topic: 'plants',
            references: [],
            definition: {
              coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
              usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
            },
          },
        },
      ],
    });
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (
      SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 453
    ) INSERT INTO word_submission_evidence_requests (id, claimed_at)
      SELECT 'previous-' || i, ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        expect(input).toBe('https://api.tavily.com/search');
        return Response.json({
          results: [
            {
              url: 'https://dictionary.example/lotus',
              title: '独立词典',
              content: '菡萏是荷花的别称。',
            },
          ],
          usage: { credits: 1 },
        });
      }),
    );
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('errored');
    const failed = await readSubmissionBatch(env.DB, batch.id);
    expect(failed.items[0]).toMatchObject({
      status: 'failed',
      failure: 'evidence-budget:quota_claim_failed',
      review: null,
    });
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM word_submission_evidence_requests',
      ).first(),
    ).toEqual({ count: 454 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 0 });
    expect(fetch).toHaveBeenCalledOnce();
    await expect(
      applySubmissionAction(env, batch.id, action(failed, 'approve', '不能绕过证据要求')),
    ).rejects.toThrow();
    await expect(applySubmissionAction(env, batch.id, action(failed, 'publish'))).rejects.toThrow();
  });

  it('preserves the model verdict through human override and rejects stale or unreviewed publication', async () => {
    const issued = await agent();
    const batch = await submit(issued.token);
    await expect(applySubmissionAction(env, batch.id, action(batch, 'publish'))).rejects.toThrow();
    const id = crypto.randomUUID();
    modelReview(false);
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('complete');
    const rejected = await readSubmissionBatch(env.DB, batch.id);
    expect(rejected.items[0]?.review?.passed).toBe(false);
    await expect(
      applySubmissionAction(env, batch.id, action(rejected, 'publish')),
    ).rejects.toThrow();
    await applySubmissionAction(
      env,
      batch.id,
      action(rejected, 'approve', '已核对画法，人工放行。'),
    );
    const approved = await readSubmissionBatch(env.DB, batch.id);
    expect(approved.items[0]).toMatchObject({
      status: 'passed',
      review: { passed: false },
      approvalReason: '已核对画法，人工放行。',
    });
    await expect(applySubmissionAction(env, batch.id, action(rejected, 'publish'))).rejects.toThrow(
      'SUBMISSION_SELECTION_STALE',
    );
    await applySubmissionAction(env, batch.id, action(approved, 'publish'));
    expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.status).toBe('published');
  });

  it('persists infrastructure failure and never retries or publishes an uncertain model call', async () => {
    const issued = await agent();
    const batch = await submit(issued.token);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('errored');
    const failed = await readSubmissionBatch(env.DB, batch.id);
    expect(failed.items[0]).toMatchObject({ status: 'failed', review: null });
    expect(fetch).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
  });

  it('settles a failed initial load and permits a fresh explicit review without replaying the old job', async () => {
    const issued = await agent();
    const batch = await submit(issued.token);
    const id = crypto.randomUUID();
    const command = action(batch, 'review', '', id);
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepError(
        { name: 'load-review' },
        new NonRetryableError('D1 load retries exhausted'),
      );
    });
    await applySubmissionAction(env, batch.id, command);
    await instance.waitForStatus('errored');
    const failed = await readSubmissionBatch(env.DB, batch.id);
    expect(failed.items[0]).toMatchObject({
      status: 'failed',
      failure: 'load-review:infrastructure_failure',
      revision: 2,
    });
    const receipt = await env.DB.prepare(
      'SELECT status, completed_at FROM word_submission_actions WHERE id = ?',
    )
      .bind(id)
      .first<{ status: string; completed_at: string | null }>();
    expect(receipt?.status).toBe('failed');
    expect(receipt?.completed_at).toBeTypeOf('string');
    expect((await listSubmissionBatches(env.DB, { status: 'reviewing' })).batches).toEqual([]);
    expect((await listSubmissionBatches(env.DB, { status: 'failed' })).batches[0]?.id).toBe(
      batch.id,
    );
    expect(await readSubmissionSettings(env.DB)).toMatchObject({ failed: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(await applySubmissionAction(env, batch.id, command)).toEqual({ id, status: 'failed' });

    modelReview();
    const nextId = crypto.randomUUID();
    await using next = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, nextId);
    await applySubmissionAction(env, batch.id, action(failed, 'review', '', nextId));
    await next.waitForStatus('complete');
    expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.status).toBe('passed');
    expect(fetch).toHaveBeenCalledOnce();
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
  });

  it('reconciles an errored instance whose failure checkpoint could not persist and never confirms it as running', async () => {
    const issued = await agent();
    const batch = await submit(issued.token);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepError(
        { name: 'load-review' },
        new NonRetryableError('D1 load retries exhausted'),
      );
      await modifier.mockStepError(
        { name: 'fail-review' },
        new NonRetryableError('D1 failure write retries exhausted'),
      );
    });
    await applySubmissionAction(env, batch.id, action(batch, 'review', '', id));
    await instance.waitForStatus('errored');
    expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.status).toBe('reviewing');
    const dispatch = () =>
      SELF.fetch(`https://test.invalid/admin/word-submissions/batches/${batch.id}/dispatch`, {
        method: 'POST',
        headers: { 'X-Admin-Token': env.ADMIN_PASSWORD, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: id }),
      });
    expect((await dispatch()).status).toBe(409);
    const recovered = await readSubmissionBatch(env.DB, batch.id);
    expect(recovered.items[0]).toMatchObject({
      status: 'failed',
      failure: 'dispatch:errored',
      revision: 2,
    });
    expect((await dispatch()).status).toBe(409);
    expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.revision).toBe(2);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM word_submission_events WHERE action_id = ? AND action = 'failed'",
      )
        .bind(id)
        .first(),
    ).toEqual({ count: 1 });
    expect((await listSubmissionBatches(env.DB, { status: 'failed' })).batches[0]?.id).toBe(
      batch.id,
    );
    expect(await readSubmissionSettings(env.DB)).toMatchObject({ failed: 1 });
    expect(fetch).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 0 });

    modelReview();
    const nextId = crypto.randomUUID();
    await using next = await introspectWorkflowInstance(env.WORD_SUBMISSION_REVIEW, nextId);
    await applySubmissionAction(env, batch.id, action(recovered, 'review', '', nextId));
    await next.waitForStatus('complete');
    expect((await readSubmissionBatch(env.DB, batch.id)).items[0]?.status).toBe('passed');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([100, 10000])(
    'keeps indexed reads and insertion writes bounded with %i historical batches',
    async (size) => {
      const issued = await agent();
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
      INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
      SELECT printf('00000000-0000-4000-8000-%012d', i), ?, 'drawguess', 'history-' || i,
        'hash-' || i, '2020-01-01T00:00:00.000Z' FROM n`,
      )
        .bind(size, issued.agent.id)
        .run();
      await env.DB.prepare(
        `INSERT INTO word_submission_items
        (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status)
        SELECT '10000000-0000-4000-8000-' || printf('%012d', rowid),
          id, game, 'historical', 'identity-' || rowid, printf('%064x', rowid),
          '历史词语', 'animals', '{}', 'dismissed' FROM word_submission_batches`,
      ).run();
      await env.DB.prepare(
        `INSERT INTO word_submission_search (rowid, game, agent, search_text, statuses)
      SELECT rowid, game, agent_id, id || ' historical', 'dismissed' FROM word_submission_batches`,
      ).run();
      const measured = createRowCountingDb(env.DB);
      const principal = await authenticateSubmissionToken(measured.db, `Bearer ${issued.token}`);
      expect(principal.agent.id).toBe(issued.agent.id);
      expect(measured.counts.rowsRead).toBeLessThan(30);
      measured.reset();
      expect(
        (await listSubmissionBatches(measured.db, { game: 'drawguess', search: '不存在' })).batches,
      ).toEqual([]);
      expect(measured.counts.rowsRead).toBeLessThan(100);
      const batch = await submit(issued.token);
      measured.reset();
      expect(
        (await listSubmissionBatches(measured.db, { game: 'drawguess', search: '大熊' })).batches[0]
          ?.id,
      ).toBe(batch.id);
      expect(measured.counts.rowsRead).toBeLessThan(150);
      measured.reset();
      const full = await listSubmissionBatches(measured.db, {
        game: 'drawguess',
        agent: issued.agent.id,
        status: 'dismissed',
      });
      expect(full.batches).toHaveLength(30);
      expect(full.batches.every((entry) => entry.counts.dismissed === 1)).toBe(true);
      expect(full.nextCursor).not.toBeNull();
      expect(measured.counts.rowsRead).toBeLessThan(1000);
      measured.reset();
      const next = await listSubmissionBatches(measured.db, {
        game: 'drawguess',
        status: 'dismissed',
        cursor: Number(full.nextCursor),
      });
      expect(next.batches).toHaveLength(30);
      expect(
        next.batches.some((entry) => full.batches.some((previous) => previous.id === entry.id)),
      ).toBe(false);
      expect(measured.counts.rowsRead).toBeLessThan(1000);
      measured.reset();
      const fresh = {
        ...payload,
        items: [{ clientItemId: 'fresh', content: { ...candidate, word: '北极熊' } }],
      };
      const validation = await validateSubmission(measured.db, fresh, principal);
      await storeSubmission(
        measured.db,
        fresh,
        principal,
        crypto.randomUUID(),
        'fresh-hash',
        validation.items,
      );
      expect(measured.counts.rowsWritten).toBeGreaterThan(0);
      expect(measured.counts.rowsWritten).toBeLessThan(150);
      expect(measured.counts.rowsRead).toBeLessThan(300);
      measured.reset();
      const maximum: WordSubmissionInput = {
        ...payload,
        items: [
          '长颈鹿',
          '大象',
          '老虎',
          '狮子',
          '猴子',
          '松鼠',
          '熊猫',
          '猎豹',
          '海豚',
          '鲸鱼',
          '鲨鱼',
          '章鱼',
          '水母',
          '螃蟹',
          '龙虾',
          '蝴蝶',
          '蜜蜂',
          '蜻蜓',
          '蚂蟥',
          '蜘蛛',
          '蜗牛',
          '乌龟',
          '野兔',
          '青蛙',
          '孔雀',
          '麻雀',
          '鹦鹉',
          '鸵鸟',
          '斑马',
          '袋鼠',
        ].map((word, index) => ({
          clientItemId: `maximum-${index}`,
          content: { ...candidate, word },
        })),
      };
      const validationQueries = vi.spyOn(measured.db, 'prepare');
      const normalized = await validateSubmission(measured.db, maximum, principal);
      expect(validationQueries).toHaveBeenCalledTimes(2);
      validationQueries.mockRestore();
      expect(normalized.validation.items.filter((item) => item.status === 'invalid')).toEqual([]);
      const maximumBatch = await storeSubmission(
        measured.db,
        maximum,
        principal,
        crypto.randomUUID(),
        'maximum-hash',
        normalized.items,
      );
      expect(maximumBatch.items).toHaveLength(30);
      expect(maximumBatch.items.every((item) => item.status === 'pending')).toBe(true);
      expect(measured.counts.rowsWritten).toBeGreaterThan(0);
      expect(measured.counts.rowsWritten).toBeLessThan(1000);
      expect(measured.counts.rowsRead).toBeLessThan(2000);
      const plan = await env.DB.prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM word_submission_items
        WHERE game = ? AND content_hash = ? AND status <> 'duplicate' LIMIT 1`,
      )
        .bind('drawguess', 'a'.repeat(64))
        .all<{ detail: string }>();
      expect(
        plan.results.some((row) => row.detail.includes('idx_word_submission_items_content')),
      ).toBe(true);
    },
  );
});
