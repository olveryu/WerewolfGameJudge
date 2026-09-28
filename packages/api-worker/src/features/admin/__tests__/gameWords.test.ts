/**
 * Admin game word-supply endpoints — integration tests.
 *
 * Verifies GET /admin/games/words/stats returns the per-game dashboard shape,
 * rejects unknown games, requires the admin token, and POST
 * /admin/games/words/trigger-supply enqueues a workflow run.
 * Runs in the Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const ADMIN_TOKEN = 'test-admin-token-do-not-use-in-production';

const fetchWordsStats = (path: string, token: string | null): Promise<Response> =>
  SELF.fetch(`https://test.local${path}`, {
    headers: token === null ? {} : { 'X-Admin-Token': token },
  });

const postTriggerSupply = (path: string, token: string, body: unknown): Promise<Response> =>
  SELF.fetch(`https://test.local${path}`, {
    method: 'POST',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
  await env.DB.prepare(
    `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, created_at, activated_at)
     VALUES ('w1', '测试词', '含义', '用法', 'literary', 'local', 'active', 1, datetime('now'), datetime('now'))`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO fib_word_supply_months (id, requests_reserved, published_count)
     VALUES ('2026-09', 3, 2)`,
  ).run();
});

describe('GET /admin/games/words/stats', () => {
  it('returns the fibking dashboard shape', async () => {
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      game: string;
      wordsByCategory: Array<{ category: string; active: number; total: number }>;
      monthlySupply: { month: string; reserved: number; published: number } | null;
      reviewDecisions: unknown[];
      queryLeaderboard: unknown[];
      supplyEnabled: boolean;
    };
    expect(body.game).toBe('fibking');
    expect(body.wordsByCategory).toEqual([{ category: 'literary', active: 1, total: 1 }]);
    expect(body.monthlySupply).toMatchObject({ month: '2026-09', reserved: 3, published: 2 });
    expect(Array.isArray(body.reviewDecisions)).toBe(true);
    expect(Array.isArray(body.queryLeaderboard)).toBe(true);
    expect(typeof body.supplyEnabled).toBe('boolean');
  });

  it('reports attempted packs alongside published words per search query', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, search_index)
         VALUES ('p1', '2026-09', 't1', 'literary', 'published', datetime('now'), 5),
                ('p2', '2026-09', 't2', 'literary', 'failed', datetime('now'), 5)`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at, completed_at)
         VALUES ('p1', 'completed', 'gemini', 'gemini', '11', datetime('now'), datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at)
         VALUES ('w2', '词二', '含义', '用法', 'literary', 'local', 'active', 2, 'p1', datetime('now'), datetime('now'))`,
      ),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      queryLeaderboard: Array<{ publishedWords: number; packs: number }>;
    };
    // Grouped by (search_index, prompt_version): p1 published 1 word, p2 failed with no cycle.
    expect(body.queryLeaderboard).toHaveLength(2);
    const totalPacks = body.queryLeaderboard.reduce((sum, row) => sum + row.packs, 0);
    const totalWords = body.queryLeaderboard.reduce((sum, row) => sum + row.publishedWords, 0);
    expect(totalPacks).toBe(2);
    expect(totalWords).toBe(1);
  });

  it('returns the undercover dashboard shape without a monthly budget', async () => {
    const resp = await fetchWordsStats('/admin/games/words/stats?game=undercover', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { game: string; monthlySupply: unknown };
    expect(body.game).toBe('undercover');
    expect(body.monthlySupply).toBeNull();
  });

  it('rejects unknown games and missing tokens', async () => {
    const badGame = await fetchWordsStats('/admin/games/words/stats?game=mahjong', ADMIN_TOKEN);
    expect(badGame.status).toBe(400);
    const noToken = await fetchWordsStats('/admin/games/words/stats?game=fibking', null);
    expect(noToken.status).toBe(401);
  });
});

describe('POST /admin/games/words/trigger-supply', () => {
  it('enqueues a workflow run and echoes the request', async () => {
    const resp = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game: 'fibking',
      force: true,
    });
    expect(resp.status).toBe(202);
    const body = (await resp.json()) as { game: string; force: boolean; workflowId: string };
    expect(body).toMatchObject({ game: 'fibking', force: true });
    expect(body.workflowId).toMatch(/^fibking-manual-\d+$/);
  });

  it('rejects invalid bodies and missing tokens', async () => {
    const badBody = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game: 'mahjong',
    });
    expect(badBody.status).toBe(400);
    const wrongToken = await postTriggerSupply('/admin/games/words/trigger-supply', 'wrong', {
      game: 'fibking',
    });
    expect(wrongToken.status).toBe(403);
  });
});
