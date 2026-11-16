/** Real D1 publication contracts: quota, immutable ordering, and replay-safe accounting. */
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupFibWordAudit } from '../maintenance';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  reserveFibWordPack,
  selectFibWordSearch,
} from '../wordPublication';
import { FIB_WORD_SEARCHES } from '../wordSearchPlan';
import {
  classifyFibWords,
  getFibWordsToClassify,
  storeFibWordTopics,
} from '../wordTopicClassification';
import { FIB_WORD_TOPIC_IDS } from '../wordTopics';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_word_usages'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => vi.unstubAllGlobals());

describe('Fib word publication', () => {
  it('adds topic fields without changing existing inventory or draw indexes', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at)
       VALUES ('legacy', '旧词', '原本的准确释义', '原本的使用提示', 'niche', 'local',
         'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    await env.DB.prepare(
      "INSERT INTO fib_word_sequence (word, published_at) VALUES ('旧词', '2026-01-01')",
    ).run();
    const beforeIndex = await env.DB.prepare(
      "SELECT members FROM word_draw_index WHERE pool = 'fibking' AND partition_key = 'all'",
    ).first();
    await env.DB.batch([
      env.DB.prepare('DROP INDEX idx_fib_words_topic'),
      env.DB.prepare('DROP INDEX idx_fib_word_packs_topic_created'),
      env.DB.prepare('ALTER TABLE fib_words DROP COLUMN topic'),
      env.DB.prepare('ALTER TABLE fib_word_packs DROP COLUMN topic'),
      env.DB.prepare('ALTER TABLE fib_word_packs DROP COLUMN search_selected_at'),
    ]);
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0069_fib_word_topics.sql');
    if (migration === undefined) throw new Error('Fib topic migration is missing');
    // The candidates table is dropped (0085), so the migration's candidates
    // leg cannot re-run; re-apply only the inventory/pack legs.
    const queries = migration.queries.filter((query) => !query.includes('fib_word_candidates'));
    await env.DB.batch(queries.map((query) => env.DB.prepare(query)));
    expect(await env.DB.prepare('SELECT id, word, status, topic FROM fib_words').first()).toEqual({
      id: 'legacy',
      word: '旧词',
      status: 'active',
      topic: null,
    });
    expect(
      await env.DB.prepare(
        "SELECT members FROM word_draw_index WHERE pool = 'fibking' AND partition_key = 'all'",
      ).first(),
    ).toEqual(beforeIndex);
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    expect(await getFibWordsToClassify(env.DB)).toHaveLength(1);
  });

  it('selects a less stocked topic at search time and rotates its concrete queries', async () => {
    for (const topic of FIB_WORD_TOPIC_IDS) {
      expect(
        FIB_WORD_SEARCHES.filter((search) => search.topic === topic).length,
      ).toBeGreaterThanOrEqual(2);
    }
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at, topic)
       VALUES ('existing', '旧词', '原本的准确释义', '原本的使用提示', 'niche', 'local',
         'active', 0, '2026-01-01', '2026-01-01', 'astronomy')`,
    ).run();
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 'first');
    if (pack === null) throw new Error('Expected reservation');
    expect(
      await env.DB.prepare('SELECT search_index, topic FROM fib_word_packs WHERE id = ?')
        .bind(pack.id)
        .first(),
    ).toEqual({ search_index: null, topic: null });
    const first = await selectFibWordSearch(env.DB, pack);
    expect(first.topic).not.toBe('astronomy');
    expect(await selectFibWordSearch(env.DB, pack)).toEqual(first);
    await env.DB.prepare("UPDATE fib_word_packs SET search_selected_at = '2020-01-01' WHERE id = ?")
      .bind(pack.id)
      .run();
    await env.DB.batch(
      FIB_WORD_TOPIC_IDS.filter((topic) => topic !== first.topic).map((topic) =>
        env.DB.prepare(
          `INSERT INTO fib_word_packs (id, month_id, request_token, category, topic, status, created_at, search_selected_at)
        VALUES (?, '2026-09', ?, 'niche', ?, 'published', ?, ?)`,
        ).bind(
          `attempt-${topic}`,
          topic,
          topic,
          new Date().toISOString(),
          new Date().toISOString(),
        ),
      ),
    );
    const nextPack = await reserveFibWordPack(env.DB, '2026-09-01', 'second');
    if (nextPack === null) throw new Error('Expected next reservation');
    const next = await selectFibWordSearch(env.DB, nextPack);
    expect(next.topic).toBe(first.topic);
    expect(next.searchIndex).not.toBe(first.searchIndex);
  });

  it('prioritizes the least stocked topic over its recent-search cooldown', async () => {
    const leastStockedTopic = FIB_WORD_TOPIC_IDS[0];
    if (leastStockedTopic === undefined) throw new Error('Expected Fib topics');
    const stockedTopics = FIB_WORD_TOPIC_IDS.filter((topic) => topic !== leastStockedTopic);
    await env.DB.batch(
      stockedTopics.map((topic, index) =>
        env.DB.prepare(
          `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
             selection_key, created_at, activated_at, topic)
           VALUES (?, ?, '释义', '提示', 'niche', 'local', 'active', ?, '2026-01-01', '2026-01-01', ?)`,
        ).bind(`stock-${topic}`, `词-${topic}`, index, topic),
      ),
    );
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO fib_word_supply_months (id) VALUES ('2026-09')").run();
    await env.DB.batch(
      FIB_WORD_TOPIC_IDS.map((topic) =>
        env.DB.prepare(
          `INSERT INTO fib_word_packs (id, month_id, request_token, category, topic, status, created_at, search_selected_at)
           VALUES (?, '2026-09', ?, 'niche', ?, 'published', ?, ?)`,
        ).bind(
          `history-${topic}`,
          `token-${topic}`,
          topic,
          now,
          topic === leastStockedTopic ? now : '2020-01-01',
        ),
      ),
    );

    const pack = await reserveFibWordPack(env.DB, '2026-09-02', 'first');
    if (pack === null) throw new Error('Expected reservation');
    expect((await selectFibWordSearch(env.DB, pack)).topic).toBe(leastStockedTopic);
  });

  it('classifies existing words without changing their identity or stale definitions', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at)
       VALUES ('old', '旧词', '原本的准确释义', '原本的使用提示', 'niche', 'local',
         'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 'first');
    if (pack === null) throw new Error('Expected reservation');
    const words = await getFibWordsToClassify(env.DB);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({ classifications: [{ index: 0, topic: 'customs' }] }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    const classifications = await classifyFibWords('test-key', words);
    await env.DB.prepare(
      "UPDATE fib_words SET core_meaning = '已修正的词义' WHERE id = 'old'",
    ).run();
    await storeFibWordTopics(env.DB, words, classifications);
    expect(await getFibWordsToClassify(env.DB)).toHaveLength(1);
    const currentWords = await getFibWordsToClassify(env.DB);
    await storeFibWordTopics(env.DB, currentWords, classifications);
    expect(await env.DB.prepare('SELECT id, word, status, topic FROM fib_words').first()).toEqual({
      id: 'old',
      word: '旧词',
      status: 'active',
      topic: 'customs',
    });
    expect(await getFibWordsToClassify(env.DB)).toEqual([]);
  });

  it('rejects invalid classification output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      classifications: [{ word: '另一个词', topic: 'customs' }],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    await expect(
      classifyFibWords('test-key', [
        { id: 'old', word: '旧词', coreMeaning: '原本的准确释义', usageNote: '原本的使用提示' },
      ]),
    ).rejects.toThrow();
  });

  it('does not assign searches at reservation time', async () => {
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 'first')).not.toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 'first')).toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-02', 'first')).not.toBeNull();
    expect(
      (
        await env.DB.prepare(
          'SELECT search_index FROM fib_word_packs WHERE search_index IS NOT NULL',
        ).all()
      ).results,
    ).toEqual([]);
  });

  it('does not resend an uncertain external request after a restart', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 'first');
    if (pack === null) throw new Error('Expected pack reservation');
    await claimFibWordProviderRequest(env.DB, pack, 'discovery');
    await expect(claimFibWordProviderRequest(env.DB, pack, 'discovery')).rejects.toThrow(
      'already consumed',
    );
  });

  it('caps search and extraction together without spending the model reservations', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 'first');
    if (pack === null) throw new Error('Expected pack reservation');
    for (const operation of [
      'discovery',
      'extraction',
      'verification-0',
      'verification-extraction-0',
      'verification-1',
      'verification-extraction-1',
      'verification-2',
    ] as const) {
      await claimFibWordProviderRequest(env.DB, pack, operation);
    }
    await expect(
      claimFibWordProviderRequest(env.DB, pack, 'verification-extraction-2'),
    ).rejects.toThrow('budget exhausted');
    await claimFibWordProviderRequest(env.DB, pack, 'generation');
    await claimFibWordProviderRequest(env.DB, pack, 'review');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_provider_requests').first(),
    ).toEqual({ count: 9 });
  });

  it('refuses new work when capacity is paused', async () => {
    await env.DB.prepare("UPDATE database_capacity SET state = 'paused' WHERE id = 1").run();
    expect(await reserveFibWordPack(env.DB, '2026-11-01', 'first')).toBeNull();
  });

  it('reserves a new pack after a failed pack without consuming any monthly counter', async () => {
    const firstPack = await reserveFibWordPack(env.DB, '2026-08-01', 'first');
    if (firstPack === null) throw new Error('Expected editorial pack');
    await failFibWordPack(env.DB, firstPack, 'generation:timedOut');
    const secondPack = await reserveFibWordPack(env.DB, '2026-08-01', 'second');
    expect(secondPack).not.toBeNull();
    expect(secondPack?.id).toBe('2026-08-01-second');
    // The month row is only the foreign-key parent for pack month ids; its
    // counters are dead — no quota is consumed by reserving or failing.
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 0, published_count: 0 });
  });

  it('expires orphaned word usages older than the retention window and keeps recent ones', async () => {
    // The candidate tables are dropped (0085), so retention only covers
    // usages now: an old usage from a room that no longer exists is
    // deleted, a recent one is kept.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO fib_word_usages (room_creation_id, round_id, word, source, used_at, participant_count)
         VALUES ('room-old', 'round-1', '旧词', 'local', '2026-06-01T00:00:00.000Z', 3)`,
      ),
      env.DB.prepare(
        `INSERT INTO fib_word_usages (room_creation_id, round_id, word, source, used_at, participant_count)
         VALUES ('room-new', 'round-1', '新词', 'local', '2026-09-01T00:00:00.000Z', 3)`,
      ),
    ]);
    await cleanupFibWordAudit(env.DB, Date.parse('2026-09-11T00:00:00.000Z'));
    expect((await env.DB.prepare('SELECT word FROM fib_word_usages').all()).results).toEqual([
      { word: '新词' },
    ]);
  });
});

describe('Fib word run-id reservation', () => {
  it('gives each run its own pack id from the run id and refuses a replay', async () => {
    const first = await reserveFibWordPack(env.DB, '2026-10-01', 'run-1');
    if (first === null) throw new Error('Expected reservation');
    expect(first.id).toBe('2026-10-01-run-1');
    const second = await reserveFibWordPack(env.DB, '2026-10-01', 'run-2');
    expect(second?.id).toBe('2026-10-01-run-2');
    // The same run id replays the same pack id, which is already taken.
    await expect(reserveFibWordPack(env.DB, '2026-10-01', 'run-1')).resolves.toBeNull();
    // A repeated manual run on the same day gets its own id.
    const third = await reserveFibWordPack(env.DB, '2026-10-02', 'run-1');
    expect(third?.id).toBe('2026-10-02-run-1');
  });
});
