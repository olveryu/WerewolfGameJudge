/**
 * Admin game word-supply endpoints — integration tests.
 *
 * Verifies GET /admin/games/words/stats returns the per-game dashboard shape,
 * rejects unknown games, requires the admin token, and POST
 * /admin/games/words/trigger-supply enqueues a workflow run.
 * Runs in the Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import {
  GAME_WORD_GAMES,
  type GameWordsStats,
  type TriggerSupplyResult,
} from '@game-judge/game-engine/product/wordSupply';
import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { getGameWordsStats, triggerGameWordSupply } from '../gameWords';

const ADMIN_TOKEN = 'test-admin-token-do-not-use-in-production';

afterEach(() => vi.restoreAllMocks());

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
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare('DELETE FROM undercover_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
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
  it('keeps fibking leaderboard reads linear in inventory, not packs times inventory', async () => {
    await env.DB.prepare(
      `
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 30)
      INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, search_index)
      SELECT 'budget-pack-' || i, '2026-09', 'budget-token-' || i, 'literary', 'published', datetime('now'), i FROM n
    `,
    ).run();
    await env.DB.prepare(
      `
      INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at, completed_at)
      SELECT id, 'completed', 'gemini', 'gemini', '11', created_at, created_at FROM fib_word_packs
    `,
    ).run();
    const measured = createRowCountingDb(env.DB);
    async function addWords(start: number, end: number) {
      await env.DB.prepare(
        `
        WITH RECURSIVE n(i) AS (SELECT CAST(? AS INTEGER) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
        INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at)
        SELECT 'budget-word-' || i, '预算词' || i, '含义', '用法', 'literary', 'local', 'active', 100 + i,
          'budget-pack-' || ((i % 30) + 1), datetime('now'), datetime('now') FROM n
      `,
      )
        .bind(start, end)
        .run();
    }
    await addWords(1, 50);
    await getGameWordsStats({ ...env, DB: measured.db }, 'fibking');
    const before = measured.counts.rowsRead;
    await addWords(51, 500);
    measured.reset();
    const result = await getGameWordsStats({ ...env, DB: measured.db }, 'fibking');
    expect(result.queryLeaderboard.reduce((sum, row) => sum + row.publishedWords, 0)).toBe(500);
    expect(measured.counts.rowsRead - before).toBeLessThanOrEqual(450 * 8);
  });

  it.each(['undercover', 'drawguess'] as const)(
    'does not rescan %s candidates once per pack',
    async (game) => {
      const packs = `${game}_word_packs`;
      const candidates = `${game}_word_candidates`;
      await env.DB.prepare(
        `
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 30)
      INSERT INTO ${packs} (id, category, request_token, status, model, prompt_version, review_version, created_at)
      SELECT 'budget-pack-' || i, 'food', 'token-' || i, 'published', 'gemini', '1', '1', datetime('now') FROM n
    `,
      ).run();
      async function addCandidates(start: number, end: number) {
        const words = game === 'undercover' ? 'word_a, word_b' : 'word, difficulty';
        const values = game === 'undercover' ? "'A' || i, 'B' || i" : "'画词' || i, 'easy'";
        await env.DB.prepare(
          `
        WITH RECURSIVE n(i) AS (SELECT CAST(? AS INTEGER) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
        INSERT INTO ${candidates} (id, ${words}, category, material_json, status, claimed_pack_id, created_at, reviewed_at)
        SELECT 'budget-candidate-' || i, ${values}, 'food', '{}', 'accepted',
          'budget-pack-' || ((i % 30) + 1), datetime('now'), datetime('now') FROM n
      `,
        )
          .bind(start, end)
          .run();
      }
      const measured = createRowCountingDb(env.DB);
      await addCandidates(1, 50);
      await getGameWordsStats({ ...env, DB: measured.db }, game);
      const before = measured.counts.rowsRead;
      await addCandidates(51, 500);
      measured.reset();
      const result = await getGameWordsStats({ ...env, DB: measured.db }, game);
      expect(result.queryLeaderboard).toEqual([]);
      expect(measured.counts.rowsRead - before).toBeLessThanOrEqual(450 * 5);
    },
  );

  it.each([
    ['drawguess', 'actionComedy', '动作喜剧', 40],
    ['undercover', 'dating', '约会场景', 40],
    ['fibking', 'courtship', '婚恋风俗', 43],
  ] as const)(
    'shows the new %s category even before it has words',
    async (game, id, name, count) => {
      const response = await fetchWordsStats(`/admin/games/words/stats?game=${game}`, ADMIN_TOKEN);
      expect(response.status).toBe(200);
      const body = await response.json<GameWordsStats>();
      expect(body.categories).toHaveLength(count);
      expect(body.categories.find((category) => category.id === id)).toMatchObject({
        name,
        active: 0,
      });
    },
  );

  it('returns the fibking dashboard shape', async () => {
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    expect(body.game).toBe('fibking');
    expect(body.categories.find((category) => category.id === 'unclassified')).toMatchObject({
      name: '未标主题',
      active: 1,
    });
    expect(body.categories.find((category) => category.id === 'buildings')).toMatchObject({
      name: '建筑营造',
      active: 0,
    });
    expect(body.modelBudget).toMatchObject({ dailyLimit: 8, monthlyLimit: 120 });
    expect(body.monthlySupply).toMatchObject({ month: '2026-09', reserved: 3, published: 2 });
    expect(Array.isArray(body.reviewDecisions)).toBe(true);
    expect(Array.isArray(body.queryLeaderboard)).toBe(true);
    expect(typeof body.supplyEnabled).toBe('boolean');
  });

  it('counts published words by their actual topic rather than their search topic', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, topic, search_selected_at)
         VALUES ('topic-pack', '2026-09', 'topic-token', 'literary', 'published', datetime('now'), 'food', datetime('now'))`,
      ),
      env.DB.prepare("UPDATE fib_words SET topic = 'music' WHERE id = 'w1'"),
      env.DB.prepare(
        `INSERT INTO fib_word_sequence (word, published_at, pack_id)
         VALUES ('测试词', datetime('now'), 'topic-pack')`,
      ),
    ]);
    const response = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(response.status).toBe(200);
    const body = await response.json<GameWordsStats>();
    expect(body.categories.find((category) => category.id === 'music')).toMatchObject({
      batches: 0,
      yieldCount: 1,
    });
    expect(body.categories.find((category) => category.id === 'food')).toMatchObject({
      batches: 1,
      yieldCount: 0,
    });
  });

  it('reports per-check failure counts for rejected v11 reviews', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at, completed_at)
         VALUES ('stats-cycle', 'completed', 'gemini', 'gemini', '10', datetime('now'), datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_candidate_reviews (
           id, word, core_meaning, usage_note, category, source,
           is_established_term, is_definition_accurate,
           is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
           has_multiple_plausible_wrong_definitions, has_reveal_value,
           decision, reason, review_version, generation_cycle_id, reviewed_at
         ) VALUES
           ('stats-r1', '拒词一', '含义', '用法', 'niche', 'gemini',
            1, 1, 0, 1, 0, 0, 'rejected', '词义太熟。', '11',
            'stats-cycle', datetime('now')),
           ('stats-r2', '拒词二', '含义', '用法', 'niche', 'gemini',
            1, 0, 1, 1, 1, 0, 'rejected', '释义不准。', '11',
            'stats-cycle', datetime('now')),
           ('stats-a1', '过词一', '含义', '用法', 'niche', 'gemini',
            1, 1, 1, 1, 1, 0, 'accepted', '通过。', '11',
            'stats-cycle', datetime('now'))`,
      ),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    expect(body.reviewCheckStats).toEqual([
      { check: 'isEstablishedTerm', failCount: 0 },
      { check: 'isDefinitionAccurate', failCount: 1 },
      { check: 'isMeaningUnfamiliarToMostPlayers', failCount: 1 },
      { check: 'isMeaningDistinctFromLiteralReading', failCount: 0 },
      { check: 'hasMultiplePlausibleWrongDefinitions', failCount: 1 },
      { check: 'hasRevealValue', failCount: 2 },
    ]);
  });

  it("counts this month's Tavily operations and reports the free-plan quota", async () => {
    // The stats endpoint always uses the current UTC month; build fixtures from it
    // so this test does not rot when the calendar month changes.
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);
    const packA = `${month}-15-0`;
    const packB = `${month}-15-manual-abc-1`;
    const packPrev = `${prevMonth}-01-0`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_supply_months (id, requests_reserved, published_count)
         VALUES (?, 0, 0), (?, 0, 0)
         ON CONFLICT (id) DO NOTHING`,
      ).bind(month, prevMonth),
      env.DB.prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, search_index)
         VALUES (?, ?, 't1', 'literary', 'published', datetime('now'), 5),
                (?, ?, 't2', 'literary', 'published', datetime('now'), 5),
                (?, ?, 't3', 'literary', 'published', datetime('now'), 5)`,
      ).bind(packA, month, packB, month, packPrev, prevMonth),
      env.DB.prepare(
        `INSERT INTO fib_word_provider_requests (pack_id, operation)
         VALUES (?, 'discovery'),
                (?, 'extraction'),
                (?, 'generation'),
                (?, 'review'),
                (?, 'extraction'),
                (?, 'discovery')`,
      ).bind(packA, packA, packA, packA, packB, packPrev),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    // generation/review are Gemini model calls; the previous-month pack is another month.
    expect(body.tavilyRequestsUsed).toBe(3);
    expect(body.tavilyMonthlyQuota).toBe(1000);
  });

  it('returns null Tavily usage for games that do not use Tavily', async () => {
    const resp = await fetchWordsStats('/admin/games/words/stats?game=undercover', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    expect(body.tavilyRequestsUsed).toBeNull();
    expect(body.tavilyMonthlyQuota).toBeNull();
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
    const body = await resp.json<GameWordsStats>();
    // Grouped by (search_index, prompt_version): p1 published 1 word, p2 failed with no cycle.
    expect(body.queryLeaderboard).toHaveLength(2);
    const totalPacks = body.queryLeaderboard.reduce((sum, row) => sum + row.packs, 0);
    const totalWords = body.queryLeaderboard.reduce((sum, row) => sum + row.publishedWords, 0);
    expect(totalPacks).toBe(2);
    expect(totalWords).toBe(1);
  });

  it.each(['undercover', 'drawguess'] as const)(
    'returns the %s dashboard without a monthly budget',
    async (game) => {
      const resp = await fetchWordsStats(`/admin/games/words/stats?game=${game}`, ADMIN_TOKEN);
      expect(resp.status).toBe(200);
      const body = await resp.json<GameWordsStats>();
      expect(body.game).toBe(game);
      expect(body.monthlySupply).toBeNull();
    },
  );

  it('rejects unknown games and missing tokens', async () => {
    const badGame = await fetchWordsStats('/admin/games/words/stats?game=mahjong', ADMIN_TOKEN);
    expect(badGame.status).toBe(400);
    const noToken = await fetchWordsStats('/admin/games/words/stats?game=fibking', null);
    expect(noToken.status).toBe(401);
  });
});

describe('POST /admin/games/words/trigger-supply', () => {
  it('rejects exhausted normal requests without enqueueing, while allowing force', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const workflow = vi.spyOn(env.DRAWGUESS_WORD_SUPPLY, 'createBatch').mockResolvedValue([]);
    const rejected = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game: 'drawguess',
    });
    expect(rejected.status).toBe(429);
    expect(workflow).not.toHaveBeenCalled();
    const forced = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game: 'drawguess',
      force: true,
    });
    expect(forced.status).toBe(202);
    expect(workflow).toHaveBeenCalledOnce();
  });

  it.each(GAME_WORD_GAMES)('enqueues a %s workflow run and echoes the request', async (game) => {
    const resp = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game,
      force: true,
    });
    expect(resp.status).toBe(202);
    const body = await resp.json<TriggerSupplyResult>();
    expect(body).toMatchObject({ game, force: true });
    expect(body.workflowId).toMatch(new RegExp(`^${game}-manual-[0-9a-f-]+$`));
  });

  it.each(GAME_WORD_GAMES)('selects only the %s workflow binding', async (game) => {
    const workflows = {
      fibking: vi.spyOn(env.FIB_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      undercover: vi.spyOn(env.UNDERCOVER_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      drawguess: vi.spyOn(env.DRAWGUESS_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
    };
    const result = await triggerGameWordSupply(env, { game });
    for (const candidateGame of GAME_WORD_GAMES) {
      expect(workflows[candidateGame]).toHaveBeenCalledTimes(candidateGame === game ? 1 : 0);
    }
    const request = workflows[game].mock.calls[0][0][0];
    expect(request.id).toBe(result.workflowId);
    expect(request.params?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.params?.force).toBe(false);
    expect(request.params?.runId).toEqual(expect.any(String));
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
