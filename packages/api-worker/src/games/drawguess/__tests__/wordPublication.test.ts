/** Real D1 queue recovery and stable reservation. */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { reserveDrawGuessWordPack } from '../wordPublication';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('DrawGuess editorial publication', () => {
  it('keeps reservation reads bounded as pack history grows', async () => {
    const measured = createRowCountingDb(env.DB);
    expect(await reserveDrawGuessWordPack(measured.db, '2026-09-01', 0)).not.toBeNull();
    const baseline = measured.counts.rowsRead;
    await env.DB.prepare('DELETE FROM drawguess_word_packs').run();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
       INSERT INTO drawguess_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
       SELECT 'history-' || i, json_extract(?, '$[' || (i % 40) || ']'), 'token-' || i,
         'failed', 'test', '1', '1', '2020-01-01' FROM n`,
    )
      .bind(JSON.stringify(DRAWGUESS_WORD_CATEGORIES))
      .run();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
       INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
       SELECT 'word-' || i, 'word-' || i, 'x', json_extract(?, '$[' || (i % 40) || ']'),
         'easy', 'active', '2020-01-01' FROM n`,
    )
      .bind(JSON.stringify(DRAWGUESS_WORD_CATEGORIES))
      .run();
    measured.reset();
    expect(await reserveDrawGuessWordPack(measured.db, '2026-09-01', 0)).not.toBeNull();
    expect(measured.counts.rowsRead - baseline).toBeLessThan(4000);
  });

  it('spreads concurrent empty-inventory reservations across categories', async () => {
    const packs = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        reserveDrawGuessWordPack(env.DB, '2026-09-01', 0, {
          force: true,
          runId: `parallel-${index}`,
        }),
      ),
    );
    expect(new Set(packs.map((pack) => pack?.category)).size).toBe(10);
  });
  it('tries another equally empty category after a pack produces no words', async () => {
    const first = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
    // The reserved pack's own cooldown already pushes its category down;
    // no publish step closes it (supply only generates).
    const second = await reserveDrawGuessWordPack(env.DB, '2026-09-02', 0);
    expect(second).not.toBeNull();
    expect(second?.category).not.toBe(first.category);
  });

  it('falls back to the least stocked category when all categories are cooling down', async () => {
    const now = new Date().toISOString();
    await env.DB.batch(
      DRAWGUESS_WORD_CATEGORIES.map((category) =>
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
    const pack = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0);
    expect(pack?.category).not.toBe('animals');
  });

  it('prioritizes the least stocked category over its recent-pack cooldown', async () => {
    const stockedCategories = DRAWGUESS_WORD_CATEGORIES.filter(
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

    const pack = await reserveDrawGuessWordPack(env.DB, '2026-09-02', 0);
    expect(pack?.category).toBe('animals');
  });
});

describe('DrawGuess force reservation', () => {
  it('allows batch indexes beyond the daily limit in its own id namespace', async () => {
    const first = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
    await expect(reserveDrawGuessWordPack(env.DB, '2026-09-01', 2)).rejects.toThrow();
    const forced = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 2, {
      force: true,
      runId: 'r1',
    });
    expect(forced?.id).toBe('2026-09-01-force-r1-2');
    const forcedAgain = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 2, {
      force: true,
      runId: 'r2',
    });
    expect(forcedAgain?.id).toBe('2026-09-01-force-r2-2');
    const second = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 1);
    expect(second?.id).toBe('2026-09-01-1');
  });
});
