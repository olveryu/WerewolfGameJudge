/**
 * Admin game word-supply endpoints — integration tests.
 *
 * Verifies GET /admin/games/words/stats returns the per-game dashboard shape,
 * rejects unknown games, requires the admin token, and POST
 * /admin/games/words/trigger-supply enqueues a workflow run.
 * Runs in the Workers runtime via @cloudflare/vitest-plugin with D1.
 */

import {
  GAME_WORD_GAMES,
  type GameWordsStats,
  type TriggerSupplyResult,
} from '@game-judge/game-engine/product/wordSupply';
import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { FIB_WORD_REVIEW_VERSION } from '../../../games/fibking/wordProviders/prompt';
import {
  approveWordCandidates,
  dismissWordCandidates,
  getGameWordsStats,
  listWordCandidates,
  triggerGameWordSupply,
} from '../gameWords';

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
    env.DB.prepare('DELETE FROM word_submission_evidence_requests'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_word_candidates'),
    env.DB.prepare('DELETE FROM word_candidate_approvals'),
    env.DB.prepare('DELETE FROM word_candidate_dismissals'),
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

  it('splits the model budget by operation on the dashboard', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
         VALUES ('gen-1', 'fibking', 'model', 'generation', datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
         VALUES ('rev-1', 'undercover', 'model', 'review', datetime('now'))`,
      ),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    expect(body.modelBudget.byOperation).toEqual({
      generation: { dailyUsed: 1, monthlyUsed: 1 },
      review: { dailyUsed: 1, monthlyUsed: 1 },
    });
    // The split partitions the same totals the dashboard already shows.
    expect(body.modelBudget.dailyUsed).toBe(2);
    expect(body.modelBudget.monthlyUsed).toBe(2);
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

  it('reports per-check failure counts for current reviews and excludes legacy reviews', async () => {
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
            1, 1, 0, 1, 0, 0, 'rejected', '词义太熟。', ?,
            'stats-cycle', datetime('now')),
           ('stats-r2', '拒词二', '含义', '用法', 'niche', 'gemini',
            1, 0, 1, 1, 1, 0, 'rejected', '释义不准。', ?,
            'stats-cycle', datetime('now')),
           ('stats-a1', '过词一', '含义', '用法', 'niche', 'gemini',
            1, 1, 1, 1, 1, 0, 'accepted', '通过。', ?,
            'stats-cycle', datetime('now')),
           ('stats-legacy', '旧拒词', '含义', '用法', 'niche', 'gemini',
            0, 0, 0, 0, 0, 0, 'rejected', '旧版本拒绝记录。', '11',
            'stats-cycle', datetime('now'))`,
      ).bind(FIB_WORD_REVIEW_VERSION, FIB_WORD_REVIEW_VERSION, FIB_WORD_REVIEW_VERSION),
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
      env.DB.prepare(
        `INSERT INTO word_submission_evidence_requests (id, claimed_at)
         VALUES ('external-search', ?), ('external-extract', ?), ('previous-external', ?)`,
      ).bind(
        `${month}-01T00:00:00.000Z`,
        `${month}-02T00:00:00.000Z`,
        `${prevMonth}-01T00:00:00.000Z`,
      ),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    // generation/review are Gemini model calls; the previous-month pack is another month.
    expect(body.tavilyRequestsUsed).toBe(5);
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

describe('GET /admin/games/words/candidates', () => {
  async function seedFibCandidates() {
    await env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
       VALUES ('test-cycle', 'running', 'gemini', 'model', '1', '2026-01-01')`,
    ).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           VALUES ('fib-1', '甲词', '含义', '用法', 'literary', 'gemini',
             '[{"url": "https://example.test/a"}, {"url": "https://example.test/b"}]',
             'test-cycle', 'pending', '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           VALUES ('fib-2', '乙词', '含义', '用法', 'literary', 'gemini',
             '[]', 'test-cycle', 'pending', '2026-01-02T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           VALUES ('fib-3', '丙词', '含义', '用法', 'literary', 'gemini',
             '[]', 'test-cycle', 'approved', '2026-01-03T00:00:00.000Z')`,
      ),
    ]);
  }

  it('lists pending candidates per game and pages by creation order', async () => {
    await seedFibCandidates();
    await env.DB.prepare(
      `INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
       VALUES ('uc-1', '熬夜', '赖床', 'dailyLife', '{}', 'pending', '2026-01-01T00:00:00.000Z')`,
    ).run();
    const pending = await fetchWordsStats(
      '/admin/games/words/candidates?game=fibking',
      ADMIN_TOKEN,
    );
    expect(pending.status).toBe(200);
    const pendingBody = await pending.json<{
      candidates: Array<{ id: string; title: string; evidenceCount: number | null }>;
      nextCursor: string | null;
    }>();
    expect(pendingBody.candidates.map((item) => item.id)).toEqual(['fib-1', 'fib-2']);
    expect(pendingBody.candidates[0]).toMatchObject({ title: '甲词', evidenceCount: 2 });
    expect(pendingBody.candidates[1]).toMatchObject({ title: '乙词', evidenceCount: 0 });
    expect(pendingBody.nextCursor).toBeNull();
    const approved = await fetchWordsStats(
      '/admin/games/words/candidates?game=fibking&status=approved',
      ADMIN_TOKEN,
    );
    expect(
      (await approved.json<{ candidates: Array<{ id: string }> }>()).candidates.map(
        (item) => item.id,
      ),
    ).toEqual(['fib-3']);
    const undercover = await fetchWordsStats(
      '/admin/games/words/candidates?game=undercover',
      ADMIN_TOKEN,
    );
    expect(
      (await undercover.json<{ candidates: Array<{ id: string; title: string }> }>()).candidates,
    ).toEqual([expect.objectContaining({ id: 'uc-1', title: '熬夜 / 赖床' })]);
    expect(
      (await fetchWordsStats('/admin/games/words/candidates?game=mahjong', ADMIN_TOKEN)).status,
    ).toBe(400);
    expect((await fetchWordsStats('/admin/games/words/candidates?game=fibking', null)).status).toBe(
      401,
    );
  });

  it('rejects an invalid candidate cursor', async () => {
    expect(
      (
        await fetchWordsStats(
          '/admin/games/words/candidates?game=fibking&cursor=not-a-cursor',
          ADMIN_TOKEN,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await fetchWordsStats(
          '/admin/games/words/candidates?game=fibking&cursor=2026-01-01T00:00:00.000Z|',
          ADMIN_TOKEN,
        )
      ).status,
    ).toBe(400);
  });

  it('keeps candidate list reads bounded with a large pending queue', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
       VALUES ('test-cycle', 'running', 'gemini', 'model', '1', '2026-01-01')`,
    ).run();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500)
       INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
         evidence_json, generation_cycle_id, status, created_at)
       SELECT 'bulk-' || i, '词' || i, '含义', '用法', 'literary', 'gemini',
         '[]', 'test-cycle', 'pending', '2026-01-01T00:00:00.000Z' FROM n`,
    ).run();
    const measured = createRowCountingDb(env.DB);
    const page = await listWordCandidates(measured.db, { game: 'fibking' });
    expect(page.candidates).toHaveLength(30);
    expect(page.nextCursor).not.toBeNull();
    expect(measured.counts.rowsRead).toBeLessThan(200);
    measured.reset();
    const next = await listWordCandidates(measured.db, {
      game: 'fibking',
      cursor: page.nextCursor ?? undefined,
    });
    expect(next.candidates).toHaveLength(30);
    expect(measured.counts.rowsRead).toBeLessThan(200);
  });
});

describe('POST /admin/games/words/candidates/approve', () => {
  async function seedUndercoverCandidates() {
    await env.DB.batch(
      ['pending', 'pending', 'approved'].map((status, index) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
           VALUES (?, ?, ?, 'dailyLife', '{}', ?, ?)`,
        ).bind(
          `uc-${index}`,
          `词乙${index}`,
          `词甲${index}`,
          status,
          `2026-01-0${index + 1}T00:00:00.000Z`,
        ),
      ),
    );
  }

  it('approves pending candidates, skips the rest, and audits each approval', async () => {
    await seedUndercoverCandidates();
    const resp = await postTriggerSupply('/admin/games/words/candidates/approve', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: ['uc-0', 'uc-1', 'uc-2', 'missing'],
      reason: '人工看过，可以送审。',
    });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({
      game: 'undercover',
      approvedIds: ['uc-0', 'uc-1'],
      skippedIds: ['uc-2', 'missing'],
    });
    expect(
      (await env.DB.prepare('SELECT id, status FROM undercover_word_candidates ORDER BY id').all())
        .results,
    ).toEqual([
      { id: 'uc-0', status: 'approved' },
      { id: 'uc-1', status: 'approved' },
      { id: 'uc-2', status: 'approved' },
    ]);
    const audits = await env.DB.prepare(
      'SELECT request_id, game, candidate_id, reason FROM word_candidate_approvals ORDER BY candidate_id',
    ).all();
    expect(audits.results).toHaveLength(2);
    expect(audits.results[0]).toMatchObject({
      game: 'undercover',
      candidate_id: 'uc-0',
      reason: '人工看过，可以送审。',
    });
    expect(audits.results[0]?.request_id).toBe(audits.results[1]?.request_id);
    const approved = await listWordCandidates(env.DB, { game: 'undercover', status: 'approved' });
    expect(approved.candidates.map((item) => item.id)).toEqual(['uc-0', 'uc-1', 'uc-2']);
  });

  it('rolls back approvals when an approval audit insert fails', async () => {
    await seedUndercoverCandidates();
    await env.DB.prepare(
      `CREATE TRIGGER fail_candidate_approval_audit BEFORE INSERT ON word_candidate_approvals
       BEGIN SELECT RAISE(ABORT, 'forced approval audit failure'); END`,
    ).run();
    try {
      await expect(
        approveWordCandidates(env.DB, {
          game: 'undercover',
          candidateIds: ['uc-0'],
          reason: '人工看过，可以送审。',
        }),
      ).rejects.toThrow('forced approval audit failure');
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_candidate_approval_audit').run();
    }

    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_candidates WHERE id = ?')
        .bind('uc-0')
        .first(),
    ).toEqual({ status: 'pending' });
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM word_candidate_approvals WHERE candidate_id = ?',
      )
        .bind('uc-0')
        .first(),
    ).toEqual({ count: 0 });
  });

  it('does not approve a claimed candidate while its pack is still running', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
       VALUES ('test-cycle', 'running', 'gemini', 'model', '1', '2026-01-01')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, search_index)
       VALUES ('pack-1', '2026-09', 'token-1', 'literary', 'reserved', '2026-01-01T00:00:00.000Z', 'x'),
              ('pack-2', '2026-09', 'token-2', 'literary', 'failed', '2026-01-01T00:00:00.000Z', 'x')`,
    ).run();
    await env.DB.batch(
      ['fib-claimed-running', 'fib-claimed-failed'].map((id, index) =>
        env.DB.prepare(
          `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
             evidence_json, generation_cycle_id, status, claimed_pack_id, claimed_at, created_at)
             VALUES (?, ?, '含义', '用法', 'literary', 'gemini', '[]', 'test-cycle',
               'claimed', ?, '2026-01-01T00:00:00.000Z', ?)`,
        ).bind(
          id,
          `词${index}`,
          index === 0 ? 'pack-1' : 'pack-2',
          `2026-01-0${index + 1}T00:00:00.000Z`,
        ),
      ),
    );
    const first = await approveWordCandidates(env.DB, {
      game: 'fibking',
      candidateIds: ['fib-claimed-running', 'fib-claimed-failed'],
      reason: '人工看过，可以送审。',
    });
    expect(first.approvedIds).toEqual(['fib-claimed-failed']);
    expect(first.skippedIds).toEqual(['fib-claimed-running']);
    // Once the pack fails, the stuck claim becomes approvable.
    await env.DB.prepare("UPDATE fib_word_packs SET status = 'failed' WHERE id = 'pack-1'").run();
    const second = await approveWordCandidates(env.DB, {
      game: 'fibking',
      candidateIds: ['fib-claimed-running'],
      reason: '人工看过，可以送审。',
    });
    expect(second.approvedIds).toEqual(['fib-claimed-running']);
    expect(second.skippedIds).toEqual([]);
  });

  it('rejects invalid bodies and missing tokens', async () => {
    const empty = await postTriggerSupply('/admin/games/words/candidates/approve', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: [],
      reason: 'x',
    });
    expect(empty.status).toBe(400);
    const tooMany = await postTriggerSupply('/admin/games/words/candidates/approve', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: Array.from({ length: 31 }, (_, index) => `uc-${index}`),
      reason: 'x',
    });
    expect(tooMany.status).toBe(400);
    const noReason = await postTriggerSupply('/admin/games/words/candidates/approve', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: ['uc-0'],
      reason: '',
    });
    expect(noReason.status).toBe(400);
    const wrongGame = await postTriggerSupply(
      '/admin/games/words/candidates/approve',
      ADMIN_TOKEN,
      { game: 'mahjong', candidateIds: ['uc-0'], reason: 'x' },
    );
    expect(wrongGame.status).toBe(400);
    const wrongToken = await postTriggerSupply('/admin/games/words/candidates/approve', 'wrong', {
      game: 'undercover',
      candidateIds: ['uc-0'],
      reason: 'x',
    });
    expect(wrongToken.status).toBe(403);
  });

  it('keeps approval writes bounded at the 30-item cap', async () => {
    await seedUndercoverCandidates();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 4 UNION ALL SELECT i + 1 FROM n WHERE i < 30)
       INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
       SELECT 'uc-' || i, '词乙' || i, '词甲' || i, 'dailyLife', '{}', 'pending', '2026-01-01T00:00:00.000Z' FROM n`,
    ).run();
    const measured = createRowCountingDb(env.DB);
    const result = await approveWordCandidates(measured.db, {
      game: 'undercover',
      candidateIds: Array.from({ length: 30 }, (_, index) => `uc-${index}`),
      reason: '批量批准。',
    });
    expect(result.approvedIds).toHaveLength(28);
    // uc-2 was already approved and uc-3 was never seeded: 30 requested,
    // 28 approvable. The cap under test is the 30 requested ids, not 30 rows.
    expect(result.skippedIds).toEqual(['uc-2', 'uc-3']);
    // D1 counts index maintenance too: 3 counted writes per approval (the
    // status update touches the row + 2 status indexes) and 3 per audit row
    // (row + PK + request index) — 6 per approved candidate, linear in the
    // 30-item cap. The bound catches super-linear blowups, not the audit.
    expect(measured.counts.rowsWritten).toBeLessThan(200);
  });
});

describe('POST /admin/games/words/candidates/dismiss', () => {
  async function seedFibCandidates() {
    await env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
       VALUES ('test-cycle', 'running', 'gemini', 'model', '1', '2026-01-01')`,
    ).run();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           VALUES ('fib-1', '甲词', '含义', '用法', 'literary', 'gemini',
             '[{"url": "https://example.test/a"}]', 'test-cycle', 'pending', '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           VALUES ('fib-3', '丙词', '含义', '用法', 'literary', 'gemini',
             '[]', 'test-cycle', 'approved', '2026-01-03T00:00:00.000Z')`,
      ),
    ]);
  }

  it('dismisses pending candidates, skips the rest, and audits each dismissal', async () => {
    await seedFibCandidates();
    const resp = await postTriggerSupply('/admin/games/words/candidates/dismiss', ADMIN_TOKEN, {
      game: 'fibking',
      candidateIds: ['fib-1', 'fib-3', 'missing'],
      reason: '词太常见，不用审了。',
    });
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({
      game: 'fibking',
      dismissedIds: ['fib-1'],
      skippedIds: ['fib-3', 'missing'],
    });
    // The dismissed row is gone (fib candidates hold no terminal review
    // state); the approved row is untouched.
    expect(
      (await env.DB.prepare('SELECT id, status FROM fib_word_candidates ORDER BY id').all())
        .results,
    ).toEqual([{ id: 'fib-3', status: 'approved' }]);
    const audits = await env.DB.prepare(
      'SELECT request_id, game, candidate_id, reason FROM word_candidate_dismissals ORDER BY candidate_id',
    ).all();
    expect(audits.results).toHaveLength(1);
    expect(audits.results[0]).toMatchObject({
      game: 'fibking',
      candidate_id: 'fib-1',
      reason: '词太常见，不用审了。',
    });
  });

  it('rolls back dismissals when a dismissal audit insert fails', async () => {
    await env.DB.prepare(
      `INSERT INTO undercover_word_candidates
         (id, word_a, word_b, category, material_json, status, created_at)
       VALUES ('uc-atomic-dismiss', '词乙', '词甲', 'dailyLife', '{}', 'pending', '2026-01-01')`,
    ).run();
    await env.DB.prepare(
      `CREATE TRIGGER fail_candidate_dismissal_audit BEFORE INSERT ON word_candidate_dismissals
       BEGIN SELECT RAISE(ABORT, 'forced dismissal audit failure'); END`,
    ).run();
    try {
      await expect(
        dismissWordCandidates(env.DB, {
          game: 'undercover',
          candidateIds: ['uc-atomic-dismiss'],
          reason: '词对不合适。',
        }),
      ).rejects.toThrow('forced dismissal audit failure');
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_candidate_dismissal_audit').run();
    }

    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_candidates WHERE id = ?')
        .bind('uc-atomic-dismiss')
        .first(),
    ).toEqual({ status: 'pending' });
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM word_candidate_dismissals WHERE candidate_id = ?',
      )
        .bind('uc-atomic-dismiss')
        .first(),
    ).toEqual({ count: 0 });
  });

  it('dismisses pending undercover candidates the same way', async () => {
    await env.DB.batch(
      ['pending', 'approved'].map((status, index) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
           VALUES (?, ?, ?, 'dailyLife', '{}', ?, ?)`,
        ).bind(
          `uc-${index}`,
          `词乙${index}`,
          `词甲${index}`,
          status,
          `2026-01-0${index + 1}T00:00:00.000Z`,
        ),
      ),
    );
    const result = await dismissWordCandidates(env.DB, {
      game: 'undercover',
      candidateIds: ['uc-0', 'uc-1'],
      reason: '词对太平行，没有可玩性。',
    });
    expect(result).toEqual({
      game: 'undercover',
      dismissedIds: ['uc-0'],
      skippedIds: ['uc-1'],
    });
    expect(
      (await env.DB.prepare('SELECT id FROM undercover_word_candidates ORDER BY id').all()).results,
    ).toEqual([{ id: 'uc-1' }]);
  });

  it('rejects invalid bodies and missing tokens', async () => {
    const empty = await postTriggerSupply('/admin/games/words/candidates/dismiss', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: [],
      reason: 'x',
    });
    expect(empty.status).toBe(400);
    const tooMany = await postTriggerSupply('/admin/games/words/candidates/dismiss', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: Array.from({ length: 31 }, (_, index) => `uc-${index}`),
      reason: 'x',
    });
    expect(tooMany.status).toBe(400);
    const noReason = await postTriggerSupply('/admin/games/words/candidates/dismiss', ADMIN_TOKEN, {
      game: 'undercover',
      candidateIds: ['uc-0'],
      reason: '',
    });
    expect(noReason.status).toBe(400);
    const wrongGame = await postTriggerSupply(
      '/admin/games/words/candidates/dismiss',
      ADMIN_TOKEN,
      { game: 'mahjong', candidateIds: ['uc-0'], reason: 'x' },
    );
    expect(wrongGame.status).toBe(400);
    const wrongToken = await postTriggerSupply('/admin/games/words/candidates/dismiss', 'wrong', {
      game: 'undercover',
      candidateIds: ['uc-0'],
      reason: 'x',
    });
    expect(wrongToken.status).toBe(403);
  });

  it('keeps dismissal writes bounded at the 30-item cap', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 29)
       INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
       SELECT 'uc-' || i, '词乙' || i, '词甲' || i, 'dailyLife', '{}', 'pending', '2026-01-01T00:00:00.000Z' FROM n`,
    ).run();
    const measured = createRowCountingDb(env.DB);
    const result = await dismissWordCandidates(measured.db, {
      game: 'undercover',
      candidateIds: Array.from({ length: 30 }, (_, index) => `uc-${index}`),
      reason: '批量拒绝。',
    });
    expect(result.dismissedIds).toHaveLength(30);
    expect(result.skippedIds).toEqual([]);
    // D1 counts index maintenance too: the delete touches the row + its
    // status indexes and the audit insert touches its row + PK + request
    // index — linear in the 30-item cap. The bound catches super-linear
    // blowups, not the audit.
    expect(measured.counts.rowsWritten).toBeLessThan(200);
  });
});
