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
import {
  getGameWordsStats,
  listLibraryItems,
  triggerGameWordSupply,
  type TriggerSupplyInput,
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
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM word_submission_evidence_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM decrypto_word_packs'),
    env.DB.prepare('DELETE FROM decrypto_words'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
  await env.DB.prepare(
    `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, created_at, activated_at)
     VALUES ('w1', '测试词', '含义', '用法', 'plants', 'local', 'active', 1, datetime('now'), datetime('now'))`,
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
      SELECT 'budget-pack-' || i, '2026-09', 'budget-token-' || i, 'plants', 'published', datetime('now'), i FROM n
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
        SELECT 'budget-word-' || i, '预算词' || i, '含义', '用法', 'plants', 'local', 'active', 100 + i,
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
    'does not rescan the submission queue once per pack',
    async (game) => {
      const packs = `${game}_word_packs`;
      await env.DB.prepare(
        `
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 30)
      INSERT INTO ${packs} (id, category, request_token, status, model, prompt_version, review_version, created_at)
      SELECT 'budget-pack-' || i, 'food', 'token-' || i, 'published', 'gemini', '1', '1', datetime('now') FROM n
    `,
      ).run();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
           VALUES ('budget-agent', 'Muse', '', '["undercover", "drawguess"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z')`,
        ),
        env.DB.prepare(
          `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
           VALUES ('budget-batch', 'budget-agent', ?, 'budget-key', 'budget-hash', '2026-01-01T00:00:00.000Z')`,
        ).bind(game),
      ]);
      async function addSubmissions(start: number, end: number) {
        await env.DB.prepare(
          `
        WITH RECURSIVE n(i) AS (SELECT CAST(? AS INTEGER) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
        INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
          title, category, material_json, status, duplicate_of, revision)
        SELECT 'budget-item-' || i, 'budget-batch', ?, 'budget-item-' || i, 'identity-' || i,
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', '词' || i, 'food',
          '{"category":"food"}', 'pending', NULL, 0 FROM n
      `,
        )
          .bind(start, end, game)
          .run();
      }
      const measured = createRowCountingDb(env.DB);
      await addSubmissions(1, 50);
      await getGameWordsStats({ ...env, DB: measured.db }, game);
      const before = measured.counts.rowsRead;
      await addSubmissions(51, 500);
      measured.reset();
      const result = await getGameWordsStats({ ...env, DB: measured.db }, game);
      expect(result.queryLeaderboard).toEqual([]);
      expect(measured.counts.rowsRead - before).toBeLessThanOrEqual(450 * 5);
    },
  );

  it.each([
    ['drawguess', 'actionComedy', '动作喜剧', 40],
    ['undercover', 'dating', '约会场景', 40],
    ['decrypto', 'school', '校园学习', 40],
    ['fibking', 'courtship', '婚恋风俗', 42],
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
    expect(body.categories.find((category) => category.id === 'plants')).toMatchObject({
      name: '植物花草',
      active: 1,
    });
    expect(body.categories.find((category) => category.id === 'buildings')).toMatchObject({
      name: '建筑营造',
      active: 0,
    });
    expect(body.modelBudget).toMatchObject({ dailyUsed: 0, monthlyUsed: 0 });
    expect(body.modelBudget).not.toHaveProperty('dailyLimit');
    expect(body.modelBudget).not.toHaveProperty('monthlyLimit');
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

  it('counts published words by their actual category rather than their search category', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at, search_index, search_selected_at)
         VALUES ('category-pack', '2026-09', 'category-token', 'food', 'published', datetime('now'), 0, datetime('now'))`,
      ),
      env.DB.prepare("UPDATE fib_words SET category = 'music' WHERE id = 'w1'"),
      env.DB.prepare(
        `INSERT INTO fib_word_sequence (word, published_at, pack_id)
         VALUES ('测试词', datetime('now'), 'category-pack')`,
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

  it('reports the submission review pass rate from model verdicts', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('agent-1', 'Muse', '', '["fibking"]', 'active', 100, 100, datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('batch-1', 'agent-1', 'fibking', 'key-1', 'hash-1', datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items
         (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status, review_json)
         VALUES
         ('00000000-0000-4000-8000-000000000001', 'batch-1', 'fibking', 'passed-1', 'identity-1', '${'a'.repeat(64)}', '通过词', 'plants', '{}', 'passed', '{"passed":true,"canOverride":true,"reason":"ok","checks":{},"details":{}}'),
         ('00000000-0000-4000-8000-000000000002', 'batch-1', 'fibking', 'passed-2', 'identity-2', '${'b'.repeat(64)}', '通过词二', 'plants', '{}', 'passed', '{"passed":true,"canOverride":true,"reason":"ok","checks":{},"details":{}}'),
         ('00000000-0000-4000-8000-000000000003', 'batch-1', 'fibking', 'rejected-1', 'identity-3', '${'c'.repeat(64)}', '拒绝词', 'plants', '{}', 'rejected', '{"passed":false,"canOverride":true,"reason":"no","checks":{},"details":{}}'),
         ('00000000-0000-4000-8000-000000000004', 'batch-1', 'fibking', 'approved-1', 'identity-4', '${'d'.repeat(64)}', '人工通过词', 'plants', '{}', 'passed', NULL)`,
      ),
    ]);
    const resp = await fetchWordsStats('/admin/games/words/stats?game=fibking', ADMIN_TOKEN);
    expect(resp.status).toBe(200);
    const body = await resp.json<GameWordsStats>();
    // Two model passes and one model rejection; the human-approved item
    // carries no review_json and is not a model verdict, so it is not counted.
    expect(body.reviewDecisions).toEqual([
      { decision: 'accepted', count: 2 },
      { decision: 'rejected', count: 1 },
    ]);
    expect(body.reviewCheckStats).toEqual([
      { check: 'isEstablishedTerm', failCount: 0 },
      { check: 'isDefinitionAccurate', failCount: 0 },
      { check: 'isMeaningUnfamiliarToMostPlayers', failCount: 0 },
      { check: 'isMeaningDistinctFromLiteralReading', failCount: 0 },
      { check: 'hasMultiplePlausibleWrongDefinitions', failCount: 0 },
      { check: 'hasRevealValue', failCount: 0 },
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
         VALUES (?, ?, 't1', 'plants', 'published', datetime('now'), 5),
                (?, ?, 't2', 'plants', 'published', datetime('now'), 5),
                (?, ?, 't3', 'plants', 'published', datetime('now'), 5)`,
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
         VALUES ('p1', '2026-09', 't1', 'plants', 'published', datetime('now'), 5),
                ('p2', '2026-09', 't2', 'plants', 'failed', datetime('now'), 5)`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at, completed_at)
         VALUES ('p1', 'completed', 'gemini', 'gemini', '11', datetime('now'), datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at)
         VALUES ('w2', '词二', '含义', '用法', 'plants', 'local', 'active', 2, 'p1', datetime('now'), datetime('now'))`,
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

  it.each(['undercover', 'drawguess', 'decrypto'] as const)(
    'returns the %s dashboard shape',
    async (game) => {
      const resp = await fetchWordsStats(`/admin/games/words/stats?game=${game}`, ADMIN_TOKEN);
      expect(resp.status).toBe(200);
      const body = await resp.json<GameWordsStats>();
      expect(body.game).toBe(game);
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
  it('enqueues even when the editorial log already holds requests: no budget gate', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const workflow = vi.spyOn(env.DRAWGUESS_WORD_SUPPLY, 'createBatch').mockResolvedValue([]);
    const resp = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game: 'drawguess',
      category: 'actionComedy',
    });
    expect(resp.status).toBe(202);
    expect(workflow).toHaveBeenCalledOnce();
  });

  it.each(GAME_WORD_GAMES)('enqueues a %s workflow run and echoes the request', async (game) => {
    const category =
      game === 'fibking'
        ? 'courtship'
        : game === 'undercover'
          ? 'dating'
          : game === 'drawguess'
            ? 'actionComedy'
            : 'animals';
    const resp = await postTriggerSupply('/admin/games/words/trigger-supply', ADMIN_TOKEN, {
      game,
      category,
    });
    expect(resp.status).toBe(202);
    const body = await resp.json<TriggerSupplyResult>();
    expect(body).toMatchObject({ game });
    expect(body.workflowId).toMatch(new RegExp(`^${game}-manual-[0-9a-f-]+$`));
  });

  it.each(GAME_WORD_GAMES)('selects only the %s workflow binding', async (game) => {
    const workflows = {
      fibking: vi.spyOn(env.FIB_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      undercover: vi.spyOn(env.UNDERCOVER_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      drawguess: vi.spyOn(env.DRAWGUESS_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
      decrypto: vi.spyOn(env.DECRYPTO_WORD_SUPPLY, 'createBatch').mockResolvedValue([]),
    };
    const input: TriggerSupplyInput =
      game === 'fibking'
        ? { game, category: 'courtship' }
        : game === 'undercover'
          ? { game, category: 'dating' }
          : game === 'drawguess'
            ? { game, category: 'actionComedy' }
            : { game, category: 'animals' };
    const result = await triggerGameWordSupply(env, input);
    for (const candidateGame of GAME_WORD_GAMES) {
      expect(workflows[candidateGame]).toHaveBeenCalledTimes(candidateGame === game ? 1 : 0);
    }
    const request = workflows[game].mock.calls[0][0][0];
    expect(request.id).toBe(result.workflowId);
    expect(request.params?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.params?.runId).toEqual(expect.any(String));
    expect(request.params?.category).toBe(input.category);
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

describe('GET /admin/words/:game/library-items', () => {
  async function seedLibrary() {
    await env.DB.batch([
      // Delete dependents first: events reference items/actions, control
      // events and credentials reference agents (the agent insert trigger
      // writes a control event, so agents cannot be deleted bare).
      env.DB.prepare('DELETE FROM word_submission_events'),
      env.DB.prepare('DELETE FROM word_submission_actions'),
      env.DB.prepare('DELETE FROM word_submission_control_events'),
      env.DB.prepare('DELETE FROM word_submission_credentials'),
      env.DB.prepare('DELETE FROM word_submission_items'),
      env.DB.prepare('DELETE FROM word_submission_batches'),
      env.DB.prepare('DELETE FROM word_submission_agents'),
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('agent-1', 'Muse', '', '["fibking"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('batch-1', 'agent-1', 'fibking', 'key-1', 'hash-1', '2026-01-02T00:00:00.000Z')`,
      ),
    ]);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, verified_material_json, status, duplicate_of, revision)
         VALUES ('10000000-0000-4000-8000-000000000001', 'batch-1', 'fibking', 'item-1', '秋审',
           'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '秋审', 'plants',
           '{"word":"秋审","definition":{"coreMeaning":"提交的释义。","usageNote":"用法。"},"category":"plants","references":[]}',
           '{"word":"秋审","definition":{"coreMeaning":"已核实的释义。","usageNote":"用法。"},"category":"plants","source":"local","evidence":[]}',
           'pending', NULL, 0)`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, status, duplicate_of, revision)
         VALUES ('10000000-0000-4000-8000-000000000002', 'batch-1', 'fibking', 'item-2', '已发布词',
           'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '已发布词', 'plants',
           '{"word":"已发布词","definition":{"coreMeaning":"已发布释义。","usageNote":"用法。"},"category":"plants","references":[]}',
           'published', 'inventory:已发布词', 0)`,
      ),
    ]);
  }

  it('lists submissions oldest first with definitions and totals', async () => {
    await seedLibrary();
    const result = await listLibraryItems(env.DB, { game: 'fibking' });
    expect(result.items.map((item) => item.id)).toEqual([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ]);
    expect(result.items[0]).toMatchObject({
      title: '秋审',
      // Verified material wins over the submitted material.
      definition: '已核实的释义。',
      batchId: 'batch-1',
      agentName: 'Muse',
      status: 'pending',
      duplicateOf: null,
      contentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      revision: 0,
    });
    expect(result.items[1]).toMatchObject({
      title: '已发布词',
      definition: '已发布释义。',
      status: 'published',
      duplicateOf: 'inventory:已发布词',
    });
    expect(result.totals).toEqual({ submissions: { pending: 1, published: 1 } });
    expect(result.nextCursor).toBeNull();
  });

  it('filters by status and keeps totals unfiltered', async () => {
    await seedLibrary();
    const pending = await listLibraryItems(env.DB, { game: 'fibking', status: 'pending' });
    expect(pending.items.map((item) => item.id)).toEqual(['10000000-0000-4000-8000-000000000001']);
    // Totals ignore the filter, so the bars stay stable while filtering.
    expect(pending.totals).toEqual({ submissions: { pending: 1, published: 1 } });
    const published = await listLibraryItems(env.DB, {
      game: 'fibking',
      status: 'published',
    });
    expect(published.items.map((item) => item.id)).toEqual([
      '10000000-0000-4000-8000-000000000002',
    ]);
  });

  it('filters by exact category while keeping totals unfiltered', async () => {
    await seedLibrary();
    await env.DB.prepare(
      `UPDATE word_submission_items SET category = 'internet'
       WHERE id = '10000000-0000-4000-8000-000000000002'`,
    ).run();

    const plants = await listLibraryItems(env.DB, { game: 'fibking', category: 'plants' });
    expect(plants.items.map((item) => item.title)).toEqual(['秋审']);
    expect(plants).not.toHaveProperty('categories');
    expect(plants.totals).toEqual({ submissions: { pending: 1, published: 1 } });

    const internet = await listLibraryItems(env.DB, { game: 'fibking', category: 'internet' });
    expect(internet.items.map((item) => item.title)).toEqual(['已发布词']);
  });

  it('searches titles as literal substrings', async () => {
    await seedLibrary();
    const found = await listLibraryItems(env.DB, { game: 'fibking', search: '秋审' });
    expect(found.items.map((item) => item.title)).toEqual(['秋审']);
    const categoryIsNotSearch = await listLibraryItems(env.DB, {
      game: 'fibking',
      search: 'plants',
    });
    expect(categoryIsNotSearch.items).toEqual([]);
    const wildcard = await listLibraryItems(env.DB, { game: 'fibking', search: '%' });
    expect(wildcard.items).toEqual([]);
  });

  it('searches titles past the D1 LIKE pattern limit, literally and ASCII case-insensitively', async () => {
    await seedLibrary();
    const longTitle = '秋'.repeat(30);
    const titles = [longTitle, 'a%b', 'a_b', 'axb', 'a\\b', 'Mixed Case', 'Élan'];
    await env.DB.batch(
      titles.map((title, index) =>
        env.DB.prepare(
          `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
             title, category, material_json, status, duplicate_of, revision)
           VALUES (?, 'batch-1', 'fibking', ?, ?, ?, ?, 'plants', '{}', 'pending', NULL, 0)`,
        ).bind(
          `20000000-0000-4000-8000-00000000000${index}`,
          `search-${index}`,
          title,
          String(index).repeat(64),
          title,
        ),
      ),
    );
    const titlesFor = async (search: string) =>
      (await listLibraryItems(env.DB, { game: 'fibking', search })).items.map((item) => item.title);

    // 30 CJK characters are 90 bytes: as a LIKE pattern D1 rejects it as too complex.
    expect(await titlesFor(longTitle)).toEqual([longTitle]);
    expect(await titlesFor('秋'.repeat(20))).toEqual([longTitle]);
    expect(await titlesFor('a%b')).toEqual(['a%b']);
    expect(await titlesFor('a_b')).toEqual(['a_b']);
    expect(await titlesFor('a\\b')).toEqual(['a\\b']);
    expect(await titlesFor('mixed CASE')).toEqual(['Mixed Case']);
    // Pins parity with the LIKE it replaced (ASCII-only folding without ICU), not a ban on
    // folding: if D1's lower() ever folds É, update this line rather than the search.
    expect(await titlesFor('élan')).toEqual([]);
  });

  it('builds the undercover definition line from submission material', async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM word_submission_events'),
      env.DB.prepare('DELETE FROM word_submission_actions'),
      env.DB.prepare('DELETE FROM word_submission_control_events'),
      env.DB.prepare('DELETE FROM word_submission_credentials'),
      env.DB.prepare('DELETE FROM word_submission_items'),
      env.DB.prepare('DELETE FROM word_submission_batches'),
      env.DB.prepare('DELETE FROM word_submission_agents'),
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('agent-uc', 'Muse', '', '["undercover"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z'),
                ('agent-dg', 'Muse', '', '["drawguess"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('batch-uc', 'agent-uc', 'undercover', 'key-uc', 'hash-uc', '2026-01-02T00:00:00.000Z'),
                ('batch-dg', 'agent-dg', 'drawguess', 'key-dg', 'hash-dg', '2026-01-02T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, status, duplicate_of, revision)
         VALUES ('20000000-0000-4000-8000-000000000001', 'batch-uc', 'undercover', 'item-uc', '耳机/音箱',
           'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '耳机 / 音箱', 'dailyLife',
           '{"wordA":"耳机","wordB":"音箱","category":"dailyLife","commonTraits":["都是电子设备","都能出声"],"differences":["耳机贴耳私享","音箱外放共享"],"potentialIssues":[]}',
           'pending', NULL, 0)`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, status, duplicate_of, revision)
         VALUES ('20000000-0000-4000-8000-000000000002', 'batch-dg', 'drawguess', 'item-dg', '大熊猫',
           'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', '大熊猫', 'animals',
           '{"word":"大熊猫","category":"animals","difficulty":"easy","potentialIssues":[]}',
           'pending', NULL, 0)`,
      ),
    ]);
    const result = await listLibraryItems(env.DB, { game: 'undercover' });
    expect(result.items).toEqual([
      expect.objectContaining({
        title: '耳机 / 音箱',
        definition: '共性：都是电子设备、都能出声。差异：耳机贴耳私享、音箱外放共享。',
      }),
    ]);
    const drawguess = await listLibraryItems(env.DB, { game: 'drawguess' });
    expect(drawguess.items).toEqual([
      expect.objectContaining({ title: '大熊猫', definition: null }),
    ]);
  });

  it('pages the submission stream with one cursor', async () => {
    // The file-level beforeEach clears candidate tables but not submission
    // tables, so earlier tests' submission rows would leak into this count.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM word_submission_events'),
      env.DB.prepare('DELETE FROM word_submission_actions'),
      env.DB.prepare('DELETE FROM word_submission_control_events'),
      env.DB.prepare('DELETE FROM word_submission_credentials'),
      env.DB.prepare('DELETE FROM word_submission_items'),
      env.DB.prepare('DELETE FROM word_submission_batches'),
      env.DB.prepare('DELETE FROM word_submission_agents'),
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('agent-1', 'Muse', '', '["fibking"]', 'active', 1000, 1000, '2026-01-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('batch-1', 'agent-1', 'fibking', 'key-1', 'hash-1', '2026-01-02T00:00:00.000Z')`,
      ),
    ]);
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 35)
       INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
         title, category, material_json, status, duplicate_of, revision)
       SELECT '30000000-0000-4000-8000-' || printf('%012d', i), 'batch-1', 'fibking', 'item-' || i, '词' || i,
         'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '词' || i, 'plants',
         '{"word":"词' || i || '","definition":{"coreMeaning":"含义。","usageNote":"用法。"},"category":"plants","references":[]}',
         'pending', NULL, 0 FROM n`,
    ).run();
    const page1 = await listLibraryItems(env.DB, { game: 'fibking' });
    expect(page1.items).toHaveLength(30);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await listLibraryItems(env.DB, {
      game: 'fibking',
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.items).toHaveLength(5);
    expect(page2.nextCursor).toBeNull();
    const ids = [...page1.items, ...page2.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(35);
  });

  it('serves the submission stream over HTTP and rejects bad input', async () => {
    await seedLibrary();
    await env.DB.prepare(
      `UPDATE word_submission_items SET category = 'internet'
       WHERE id = '10000000-0000-4000-8000-000000000002'`,
    ).run();
    const ok = await fetchWordsStats('/admin/words/fibking/library-items', ADMIN_TOKEN);
    expect(ok.status).toBe(200);
    const body = await ok.json<{
      items: Array<{ id: string }>;
      totals: unknown;
      nextCursor: string | null;
    }>();
    expect(body.items.map((item) => item.id)).toEqual([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ]);
    expect(body).not.toHaveProperty('categories');
    expect(body.nextCursor).toBeNull();
    const categoryFiltered = await fetchWordsStats(
      '/admin/words/fibking/library-items?category=plants',
      ADMIN_TOKEN,
    );
    expect(
      (await categoryFiltered.json<{ items: Array<{ id: string }> }>()).items.map(
        (item) => item.id,
      ),
    ).toEqual(['10000000-0000-4000-8000-000000000001']);
    expect((await fetchWordsStats('/admin/words/fibking/library-items', null)).status).toBe(401);
    expect((await fetchWordsStats('/admin/words/mahjong/library-items', ADMIN_TOKEN)).status).toBe(
      400,
    );
    expect(
      (await fetchWordsStats('/admin/words/fibking/library-items?status=nope', ADMIN_TOKEN)).status,
    ).toBe(400);
    // An unknown source filter is ignored: the stream is submissions only.
    expect(
      (await fetchWordsStats('/admin/words/fibking/library-items?source=inventory', ADMIN_TOKEN))
        .status,
    ).toBe(200);
    expect(
      (await fetchWordsStats('/admin/words/fibking/library-items?cursor=not-a-cursor', ADMIN_TOKEN))
        .status,
    ).toBe(400);
  });
});
