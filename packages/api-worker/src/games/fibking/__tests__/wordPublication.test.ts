/** Real D1 publication contracts: quota, immutable ordering, and replay-safe accounting. */
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { cleanupFibWordAudit } from '../maintenance';
import type { FibWordEditorialCandidate } from '../wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  reserveFibWordPack,
  selectFibWordSearch,
  storeFibWordCandidates,
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
    env.DB.prepare('DELETE FROM fib_word_candidates'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
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
      env.DB.prepare('ALTER TABLE fib_word_candidates DROP COLUMN topic'),
    ]);
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0069_fib_word_topics.sql');
    if (migration === undefined) throw new Error('Fib topic migration is missing');
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
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
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
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
    const nextPack = await reserveFibWordPack(env.DB, '2026-09-01', 1);
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

    const pack = await reserveFibWordPack(env.DB, '2026-09-02', 0);
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
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
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
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).not.toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-02', 0)).not.toBeNull();
    expect(
      (
        await env.DB.prepare(
          'SELECT search_index FROM fib_word_packs WHERE search_index IS NOT NULL',
        ).all()
      ).results,
    ).toEqual([]);
  });
  it('does not resend an uncertain external request after a restart', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    await claimFibWordProviderRequest(env.DB, pack, 'discovery');
    await expect(claimFibWordProviderRequest(env.DB, pack, 'discovery')).rejects.toThrow(
      'already consumed',
    );
  });

  it('caps search and extraction together without spending the model reservations', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 0);
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

  it('refuses new work when the monthly budget is consumed or capacity is paused', async () => {
    await env.DB.prepare(
      "INSERT INTO fib_word_supply_months (id, requests_reserved) VALUES ('2026-10', 80)",
    ).run();
    expect(await reserveFibWordPack(env.DB, '2026-10-01', 0)).toBeNull();
    await env.DB.prepare("UPDATE database_capacity SET state = 'paused' WHERE id = 1").run();
    expect(await reserveFibWordPack(env.DB, '2026-11-01', 0)).toBeNull();
  });

  it('persists overflow without duplicating candidates and keeps the monthly quota on failure', async () => {
    const firstPack = await reserveFibWordPack(env.DB, '2026-08-01', 0);
    const secondPack = await reserveFibWordPack(env.DB, '2026-08-01', 1);
    if (firstPack === null || secondPack === null) throw new Error('Expected editorial packs');
    const candidates: FibWordEditorialCandidate[] = [
      '甲',
      '乙',
      '丙',
      '丁',
      '戊',
      '己',
      '庚',
      '辛',
    ].map((suffix, index) => ({
      word: `测试${suffix}`,
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      source: 'gemini',
      category: index % 2 === 0 ? 'niche' : 'literary',
      evidence: [
        {
          query: '词源',
          url: 'https://example.com/words',
          title: '测试词源',
          content: `测试${suffix}：用于测试的真实核心含义。`,
        },
      ],
    }));
    await storeFibWordCandidates(env.DB, firstPack, candidates);
    await storeFibWordCandidates(env.DB, firstPack, candidates);
    // Storing the same batch twice keeps one row per word (overflow is
    // persisted, not duplicated); nothing is published by the workflow.
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_candidates').first(),
    ).toEqual({ count: 8 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: 0,
    });
    await failFibWordPack(env.DB, firstPack, 'generation:timedOut');
    const thirdPack = await reserveFibWordPack(env.DB, '2026-08-01', 2);
    if (thirdPack === null) throw new Error('Expected recovery pack');
    expect(
      await env.DB.prepare('SELECT requests_reserved FROM fib_word_supply_months').first(),
    ).toEqual({ requests_reserved: 3 });
    // The failed pack's candidates stay pending for manual review.
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fib_word_candidates WHERE status = 'pending'",
      ).first(),
    ).toEqual({ count: 8 });
  });

  it('expires pending source snapshots without deleting approved candidates', async () => {
    const approvedPack = await reserveFibWordPack(env.DB, '2026-06-01', 0);
    const pendingPack = await reserveFibWordPack(env.DB, '2026-06-01', 1);
    if (approvedPack === null || pendingPack === null) throw new Error('Expected retention packs');
    const candidates: FibWordEditorialCandidate[] = ['测试甲', '测试乙'].map((word) => ({
      word,
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      source: 'gemini',
      category: 'niche',
      evidence: [
        {
          query: word,
          url: 'https://example.com/words',
          title: word,
          content: `${word}：用于测试的真实核心含义。`,
        },
      ],
    }));
    await storeFibWordCandidates(env.DB, approvedPack, candidates.slice(0, 1));
    // Stored candidates wait for human approval; approved ones are kept by retention.
    await env.DB.prepare(
      "UPDATE fib_word_candidates SET status = 'approved' WHERE word = '测试甲'",
    ).run();
    await storeFibWordCandidates(env.DB, pendingPack, candidates.slice(1));
    await env.DB.prepare(
      "UPDATE fib_word_candidates SET created_at = '2026-06-01T00:00:00.000Z'",
    ).run();
    await cleanupFibWordAudit(env.DB, Date.parse('2026-09-11T00:00:00.000Z'));
    expect(
      (await env.DB.prepare('SELECT word, status FROM fib_word_candidates').all()).results,
    ).toEqual([{ word: '测试甲', status: 'approved' }]);
  });

  it('keeps retention reads bounded as recent review history grows', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
       VALUES ('retention-cycle', 'running', 'gemini', 'test', '11', '2026-01-01')`,
    ).run();
    async function addReviews(start: number, end: number) {
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (SELECT CAST(? AS INTEGER) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
       INSERT INTO fib_word_candidate_reviews
         (id, word, core_meaning, usage_note, category, source, is_established_term,
          is_definition_accurate, is_meaning_unfamiliar_to_most_players,
          is_meaning_distinct_from_literal_reading, has_multiple_plausible_wrong_definitions,
          has_reveal_value, decision, reason, review_version, generation_cycle_id, reviewed_at)
       SELECT 'review-' || i, 'word-' || i, 'meaning', 'note', 'literary', 'local',
         1, 1, 1, 1, 1, 1, 'accepted', 'reason', '11', 'retention-cycle',
         CASE WHEN i = 0 THEN '2026-01-01' ELSE '2026-09-01' END FROM n`,
      )
        .bind(start, end)
        .run();
    }
    await addReviews(0, 50);
    const measured = createRowCountingDb(env.DB);
    await cleanupFibWordAudit(measured.db, Date.parse('2026-09-11T00:00:00.000Z'));
    expect(measured.counts.rowsRead).toBeLessThan(50);
    await env.DB.prepare(
      "UPDATE fib_word_candidate_reviews SET reviewed_at = '2026-01-01' WHERE id = 'review-1'",
    ).run();
    await addReviews(51, 500);
    measured.reset();
    await cleanupFibWordAudit(measured.db, Date.parse('2026-09-11T00:00:00.000Z'));
    expect(measured.counts.rowsRead).toBeLessThan(50);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_candidate_reviews').first(),
    ).toEqual({ count: 499 });
  });
});

describe('Fib word force reservation', () => {
  it('bypasses the monthly budget in its own id namespace and cycles the search index', async () => {
    // Exhaust the monthly budget: 19 days x 4 batches + 2 = 78 reserves.
    for (let d = 1; d <= 19; d += 1) {
      const day = `2026-09-${String(d).padStart(2, '0')}`;
      for (let b = 0; b < 4; b += 1) {
        expect(await reserveFibWordPack(env.DB, day, b, { batchLimit: 4 })).not.toBeNull();
      }
    }
    expect(await reserveFibWordPack(env.DB, '2026-09-20', 0, { batchLimit: 4 })).not.toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-20', 1, { batchLimit: 4 })).not.toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-20', 2, { batchLimit: 4 })).toBeNull();

    const pack = await reserveFibWordPack(env.DB, '2026-09-20', 2, {
      batchLimit: 4,
      force: true,
      runId: 'run-1',
    });
    expect(pack?.id).toBe('2026-09-20-force-run-1-2');
    const row = await env.DB.prepare('SELECT search_index FROM fib_word_packs WHERE id = ?')
      .bind('2026-09-20-force-run-1-2')
      .first<{ search_index: number }>();
    expect(row?.search_index).toBeNull();
  });

  it('never collides with scheduled pack ids on the same day', async () => {
    const scheduled = await reserveFibWordPack(env.DB, '2026-10-01', 0, { batchLimit: 4 });
    const forced = await reserveFibWordPack(env.DB, '2026-10-01', 0, {
      batchLimit: 4,
      force: true,
      runId: 'run-1',
    });
    expect(scheduled?.id).toBe('2026-10-01-0');
    expect(forced?.id).toBe('2026-10-01-force-run-1-0');
    expect(forced?.searchIndex).toBeUndefined();
  });

  it('gives repeated manual runs on the same day distinct pack ids', async () => {
    const first = await reserveFibWordPack(env.DB, '2026-10-02', 0, {
      batchLimit: 4,
      force: true,
      runId: 'aaa',
    });
    const second = await reserveFibWordPack(env.DB, '2026-10-02', 0, {
      batchLimit: 4,
      force: true,
      runId: 'bbb',
    });
    const normal = await reserveFibWordPack(env.DB, '2026-10-02', 0, {
      batchLimit: 4,
      runId: 'ccc',
    });
    expect(first?.id).toBe('2026-10-02-force-aaa-0');
    expect(second?.id).toBe('2026-10-02-force-bbb-0');
    expect(normal?.id).toBe('2026-10-02-manual-ccc-0');
  });
});
