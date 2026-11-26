/** Real D1 queue recovery and stable reservation. */
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { reserveDrawGuessWordPack } from '../wordPublication';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('DrawGuess editorial publication', () => {
  it('keeps reservation reads bounded as pack history grows', async () => {
    const measured = createRowCountingDb(env.DB);
    expect(
      await reserveDrawGuessWordPack(measured.db, '2026-09-01', 'baseline', 'animals'),
    ).not.toBeNull();
    const baseline = measured.counts.rowsRead;
    await env.DB.prepare('DELETE FROM drawguess_word_packs').run();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
       INSERT INTO drawguess_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
       SELECT 'history-' || i, json_extract(?, '$[' || (i % 40) || ']'), 'token-' || i,
         'failed', 'test', '1', '1', '2020-01-01' FROM n`,
    )
      .bind(JSON.stringify(DRAWGUESS_WORD_CATEGORY_CATALOG.ids))
      .run();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
       INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
       SELECT 'word-' || i, 'word-' || i, 'x', json_extract(?, '$[' || (i % 40) || ']'),
         'easy', 'active', '2020-01-01' FROM n`,
    )
      .bind(JSON.stringify(DRAWGUESS_WORD_CATEGORY_CATALOG.ids))
      .run();
    measured.reset();
    expect(
      await reserveDrawGuessWordPack(measured.db, '2026-09-01', 'grown', 'animals'),
    ).not.toBeNull();
    expect(measured.counts.rowsRead - baseline).toBeLessThan(4000);
  });

  it('stores the explicitly selected category for concurrent reservations', async () => {
    const categories = DRAWGUESS_WORD_CATEGORY_CATALOG.ids.slice(0, 10);
    const packs = await Promise.all(
      categories.map((category, index) =>
        reserveDrawGuessWordPack(env.DB, '2026-09-01', `parallel-${index}`, category),
      ),
    );
    expect(packs.map((pack) => pack?.category)).toEqual(categories);
  });
  it('uses the next run selected category after a pack produces no words', async () => {
    const first = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 'first', 'animals');
    if (first === null) throw new Error('Expected reservation');
    const second = await reserveDrawGuessWordPack(env.DB, '2026-09-02', 'second', 'food');
    expect(second).not.toBeNull();
    expect(second?.category).toBe('food');
    expect(first.category).toBe('animals');
  });

  it('does not replace the selected category when all categories are cooling down', async () => {
    const now = new Date().toISOString();
    await env.DB.batch(
      DRAWGUESS_WORD_CATEGORY_CATALOG.ids.map((category) =>
        env.DB.prepare(
          `INSERT INTO drawguess_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
           VALUES (?, ?, ?, 'failed', 'test', '1', '1', ?)`,
        ).bind(`attempt-${category}`, category, category, now),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
       VALUES ('stock', '大熊猫', 'dxm', 'animals', 'easy', 'active', ?)`,
    )
      .bind(now)
      .run();
    const pack = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 'fallback', 'animals');
    expect(pack?.category).toBe('animals');
  });

  it('does not replace the selected category based on stock or recent-pack cooldown', async () => {
    const stockedCategories = DRAWGUESS_WORD_CATEGORY_CATALOG.ids.filter(
      (category) => category !== 'animals',
    );
    await env.DB.batch(
      stockedCategories.map((category, index) =>
        env.DB.prepare(
          `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
           VALUES (?, ?, 'x', ?, 'easy', 'active', '2026-01-01')`,
        ).bind(`stock-${index}`, `词-${index}`, category),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO drawguess_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
       VALUES ('recent-animals', 'animals', 'recent-animals', 'failed', 'test', '1', '1', ?)`,
    )
      .bind(new Date().toISOString())
      .run();

    const pack = await reserveDrawGuessWordPack(env.DB, '2026-09-02', 'least-stocked', 'animals');
    expect(pack?.category).toBe('animals');
  });
});

describe('DrawGuess run-id reservation', () => {
  it('gives each run its own pack id from the run id and refuses a replay', async () => {
    const first = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 'r1', 'animals');
    if (first === null) throw new Error('Expected reservation');
    expect(first.id).toBe('2026-09-01-r1');
    const second = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 'r2', 'animals');
    expect(second?.id).toBe('2026-09-01-r2');
    // The same run id replays the same pack id, which is already taken.
    await expect(
      reserveDrawGuessWordPack(env.DB, '2026-09-01', 'r1', 'animals'),
    ).resolves.toBeNull();
  });
});
