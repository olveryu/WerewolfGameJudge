/**
 * Contract: the draw index always equals the drawable words of each game-owned
 * table. Triggers maintain it, so every write path (publication upserts,
 * re-review, seeds, fixtures) keeps it in step without calling shared code.
 */

import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFibWatermarkConversion } from '../../../../test/fibWordWatermarkMigration';

const NOW = '2026-11-01T00:00:00.000Z';

async function indexMembers(pool: string, partition: string): Promise<number[]> {
  const row = await env.DB.prepare(
    'SELECT members FROM word_draw_index WHERE pool = ? AND partition_key = ?',
  )
    .bind(pool, partition)
    .first<{ members: string }>();
  if (row === null) throw new Error(`Missing draw index row ${pool}/${partition}`);
  expect(row.members.startsWith(',') && row.members.endsWith(',')).toBe(true);
  return row.members
    .split(',')
    .filter((token) => token.length > 0)
    .map(Number)
    .sort((left, right) => left - right);
}

async function ordinals(query: string, ...values: string[]): Promise<number[]> {
  const result = await env.DB.prepare(query)
    .bind(...values)
    .all<{ ordinal: number }>();
  return result.results.map((row) => row.ordinal).sort((left, right) => left - right);
}

async function insertDrawGuessWord(id: string, status: 'active' | 'disabled'): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
     VALUES (?, ?, 'x', '动物', 'easy', ?, ?, ?)`,
  )
    .bind(id, `词${id}`, status, NOW, status === 'disabled' ? NOW : null)
    .run();
}

async function insertUndercoverPair(id: string, category: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
     VALUES (?, ?, ?, ?, 'active', ?, ?, '{}')`,
  )
    // word_a must sort before word_b (table CHECK).
    .bind(id, `乙${id}`, `甲${id}`, category, NOW, NOW)
    .run();
}

async function insertFibWord(id: string, word: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
       selection_key, created_at, activated_at)
     VALUES (?, ?, '用于验证抽词索引的核心含义。', '用于验证抽词索引的使用说明。',
       'literary', 'gemini', 'active', 0, ?, ?)`,
  )
    .bind(id, word, NOW, NOW)
    .run();
}

async function sequenceFibWord(word: string): Promise<void> {
  await env.DB.prepare('INSERT INTO fib_word_sequence (word, published_at) VALUES (?, ?)')
    .bind(word, NOW)
    .run();
}

const drawGuessTruth = () =>
  ordinals("SELECT draw_ordinal AS ordinal FROM drawguess_words WHERE status = 'active'");
const undercoverTruth = (category: string) =>
  ordinals(
    "SELECT draw_ordinal AS ordinal FROM undercover_word_pairs WHERE status = 'active' AND (? = 'all' OR category = ?)",
    category,
    category,
  );
const fibTruth = () =>
  ordinals(
    `SELECT sequence.id AS ordinal FROM fib_word_sequence AS sequence
     INNER JOIN fib_words AS word ON word.word = sequence.word WHERE word.status = 'active'`,
  );

beforeEach(async () => {
  await env.DB.batch(
    [
      'DELETE FROM fib_word_usages',
      'DELETE FROM fib_round_word_selections',
      'DELETE FROM undercover_round_word_selections',
      'DELETE FROM fib_words',
      'DELETE FROM fib_word_sequence',
      'DELETE FROM undercover_word_pairs',
      'DELETE FROM drawguess_words',
    ].map((query) => env.DB.prepare(query)),
  );
});

describe('word draw index', () => {
  it('holds one row per pool partition, empty once every word is gone', async () => {
    const rows = await env.DB.prepare(
      'SELECT pool, partition_key, members FROM word_draw_index ORDER BY pool, partition_key',
    ).all<{ pool: string; partition_key: string; members: string }>();
    const expected = [
      'drawguess/all',
      'fibking/all',
      ...['all', ...UNDERCOVER_CATEGORIES].sort().map((partition) => `undercover/${partition}`),
    ];
    expect(rows.results.map((row) => `${row.pool}/${row.partition_key}`)).toEqual(expected);
    expect(rows.results.every((row) => row.members === ',')).toBe(true);
  });

  it('tracks drawguess words through insert, disable, enable, upsert and delete', async () => {
    await insertDrawGuessWord('a', 'active');
    await insertDrawGuessWord('b', 'disabled');
    await insertDrawGuessWord('c', 'active');
    expect(await indexMembers('drawguess', 'all')).toEqual(await drawGuessTruth());
    expect(await drawGuessTruth()).toHaveLength(2);

    await env.DB.prepare(
      "UPDATE drawguess_words SET status = 'disabled', disabled_at = ? WHERE id = 'a'",
    )
      .bind(NOW)
      .run();
    expect(await indexMembers('drawguess', 'all')).toEqual(await drawGuessTruth());
    expect(await drawGuessTruth()).toHaveLength(1);

    // The publication upsert re-activates a known word and re-asserts an active one.
    for (const id of ['a', 'c']) {
      await env.DB.prepare(
        `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
         VALUES (?, ?, 'x', '动物', 'easy', 'active', ?, NULL)
         ON CONFLICT (id) DO UPDATE SET status = 'active', disabled_at = NULL`,
      )
        .bind(id, `词${id}`, NOW)
        .run();
    }
    expect(await indexMembers('drawguess', 'all')).toEqual(await drawGuessTruth());
    expect(await drawGuessTruth()).toHaveLength(2);

    await env.DB.prepare("DELETE FROM drawguess_words WHERE id = 'c'").run();
    expect(await indexMembers('drawguess', 'all')).toEqual(await drawGuessTruth());
    expect(await drawGuessTruth()).toHaveLength(1);
  });

  it('never reuses a drawguess ordinal, even after the newest word is deleted', async () => {
    await insertDrawGuessWord('first', 'active');
    await insertDrawGuessWord('second', 'active');
    const [, newest] = await drawGuessTruth();
    await env.DB.prepare("DELETE FROM drawguess_words WHERE id = 'second'").run();
    await insertDrawGuessWord('third', 'active');
    const [, replacement] = await drawGuessTruth();
    expect(newest).toBeDefined();
    expect(replacement).toBeGreaterThan(newest ?? Number.POSITIVE_INFINITY);
  });

  it('rejects changing an assigned ordinal', async () => {
    await insertDrawGuessWord('fixed', 'active');
    await insertUndercoverPair('fixed', 'food');
    await expect(
      env.DB.prepare('UPDATE drawguess_words SET draw_ordinal = draw_ordinal + 100').run(),
    ).rejects.toThrow('draw_ordinal is immutable');
    await expect(
      env.DB.prepare('UPDATE undercover_word_pairs SET draw_ordinal = draw_ordinal + 100').run(),
    ).rejects.toThrow('draw_ordinal is immutable');
  });

  it('tracks undercover pairs per category and in the all partition', async () => {
    await insertUndercoverPair('food-1', 'food');
    await insertUndercoverPair('food-2', 'food');
    await insertUndercoverPair('work-1', 'work');
    for (const partition of ['all', 'food', 'work', 'travel']) {
      expect(await indexMembers('undercover', partition)).toEqual(await undercoverTruth(partition));
    }
    expect(await undercoverTruth('all')).toHaveLength(3);
    expect(await undercoverTruth('food')).toHaveLength(2);

    // Re-review through the publication upsert moves a pair to another category.
    await env.DB.prepare(
      `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
       VALUES ('food-2', '乙food-2', '甲food-2', 'travel', 'active', ?, ?, '{}')
       ON CONFLICT (id) DO UPDATE SET category = excluded.category, status = 'active'`,
    )
      .bind(NOW, NOW)
      .run();
    await env.DB.prepare(
      "UPDATE undercover_word_pairs SET status = 'disabled' WHERE id = 'work-1'",
    ).run();
    for (const partition of ['all', 'food', 'work', 'travel']) {
      expect(await indexMembers('undercover', partition)).toEqual(await undercoverTruth(partition));
    }
    expect(await undercoverTruth('all')).toHaveLength(2);
    expect(await undercoverTruth('travel')).toHaveLength(1);
    expect(await undercoverTruth('work')).toHaveLength(0);
  });

  it('draws a fibking question only while it is active and sequenced', async () => {
    await insertFibWord('unsequenced', '射覆');
    expect(await indexMembers('fibking', 'all')).toEqual([]);

    await sequenceFibWord('射覆');
    await sequenceFibWord('却扇');
    expect(await indexMembers('fibking', 'all')).toEqual(await fibTruth());
    expect(await fibTruth()).toHaveLength(1);

    // A word approved after its sequence position already exists keeps that position.
    await insertFibWord('late', '却扇');
    expect(await indexMembers('fibking', 'all')).toEqual(await fibTruth());
    expect(await fibTruth()).toHaveLength(2);

    await env.DB.prepare(
      "UPDATE fib_words SET status = 'disabled', disabled_at = ?, status_reason = 'test' WHERE id = 'late'",
    )
      .bind(NOW)
      .run();
    expect(await indexMembers('fibking', 'all')).toEqual(await fibTruth());
    expect(await fibTruth()).toHaveLength(1);

    await env.DB.prepare(
      "UPDATE fib_words SET status = 'active', disabled_at = NULL, status_reason = NULL WHERE id = 'late'",
    ).run();
    expect(await indexMembers('fibking', 'all')).toEqual(await fibTruth());
    expect(await fibTruth()).toHaveLength(2);

    await env.DB.prepare("DELETE FROM fib_word_sequence WHERE word = '射覆'").run();
    expect(await indexMembers('fibking', 'all')).toEqual(await fibTruth());
    expect(await fibTruth()).toHaveLength(1);
  });
});

describe('fibking watermark migration', () => {
  it('rejects missing or duplicate watermark conversion statements', () => {
    const conversion = getFibWatermarkConversion(env.TEST_MIGRATIONS);
    const name = '0067_shared_word_draw.sql';
    expect(() => getFibWatermarkConversion([{ name, queries: [] }])).toThrow(
      'Expected one fibking watermark conversion statement, found 0',
    );
    expect(() => getFibWatermarkConversion([{ name, queries: [conversion, conversion] }])).toThrow(
      'Expected one fibking watermark conversion statement, found 2',
    );
  });

  it('turns each high-watermark into a seen range ending at the watermark', async () => {
    const conversion = getFibWatermarkConversion(env.TEST_MIGRATIONS);
    await env.DB.prepare("DELETE FROM users WHERE id IN ('watermark-a', 'watermark-b')").run();
    await env.DB.prepare('DELETE FROM fib_word_progress').run();
    await env.DB.prepare("INSERT INTO users (id) VALUES ('watermark-a'), ('watermark-b')").run();
    await env.DB.prepare(
      "INSERT INTO fib_word_progress (user_id, sequence_number) VALUES ('watermark-a', 12), ('watermark-b', 1)",
    ).run();
    await env.DB.prepare(conversion).run();
    const rows = await env.DB.prepare(
      "SELECT user_id, pool, seen FROM word_seen WHERE user_id LIKE 'watermark-%' ORDER BY user_id",
    ).all();
    expect(rows.results).toEqual([
      { user_id: 'watermark-a', pool: 'fibking', seen: ',1-12,' },
      { user_id: 'watermark-b', pool: 'fibking', seen: ',1-1,' },
    ]);
  });
});
