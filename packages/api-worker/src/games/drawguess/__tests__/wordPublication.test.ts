/** Real D1 queue recovery, exact review publication with pinyin, and stable retirement. */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import type { DrawGuessWordCandidate, DrawGuessWordReview } from '../wordEditorial';
import {
  failDrawGuessWordPack,
  getDrawGuessReviewCandidates,
  publishDrawGuessWordPack,
  reserveDrawGuessWordPack,
  storeDrawGuessWordCandidates,
} from '../wordPublication';

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
    await publishDrawGuessWordPack(env.DB, first, [], []);
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

  it('resumes failed material and atomically publishes once with pinyin initials', async () => {
    const first = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
    expect(await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    const candidate: DrawGuessWordCandidate = {
      word: '大熊猫',
      category: first.category,
      difficulty: 'easy',
      potentialIssues: [],
    };
    await storeDrawGuessWordCandidates(env.DB, first, [candidate]);
    const candidates = await getDrawGuessReviewCandidates(env.DB, first);
    expect(candidates).toHaveLength(1);
    await failDrawGuessWordPack(env.DB, first, 'review:timedOut');
    await env.DB.prepare("UPDATE drawguess_word_packs SET created_at = '2020-01-01' WHERE id = ?")
      .bind(first.id)
      .run();
    await env.DB.batch(
      DRAWGUESS_WORD_CATEGORIES.filter((category) => category !== first.category).map((category) =>
        env.DB.prepare(
          `INSERT INTO drawguess_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
        VALUES (?, ?, ?, 'failed', 'test', '1', '1', ?)`,
        ).bind(`attempt-${category}`, category, category, new Date().toISOString()),
      ),
    );
    const second = await reserveDrawGuessWordPack(env.DB, '2026-09-02', 0);
    if (second === null) throw new Error('Expected resumed reservation');
    expect(await getDrawGuessReviewCandidates(env.DB, second)).toEqual(candidates);
    const reviewPayload: DrawGuessWordReview = {
      word: candidate.word,
      qualityChecks: {
        isConcreteAndDrawable: true,
        isSimplifiedChinese: true,
        isLengthValid: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isUnambiguous: true,
      },
      reason: '常见动物，外形特征明确，好画好猜。',
    };
    await env.DB.prepare(
      `CREATE TRIGGER reject_pack_completion BEFORE UPDATE OF status ON drawguess_word_packs
      WHEN NEW.status = 'published' BEGIN SELECT RAISE(ABORT, 'publication failed'); END`,
    ).run();
    try {
      await expect(
        publishDrawGuessWordPack(env.DB, second, candidates, [reviewPayload]),
      ).rejects.toThrow('publication failed');
    } finally {
      await env.DB.prepare('DROP TRIGGER reject_pack_completion').run();
    }
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(
      await env.DB.prepare('SELECT status, review_json FROM drawguess_word_candidates').first(),
    ).toEqual({ status: 'pending', review_json: null });
    expect(
      await env.DB.prepare('SELECT status FROM drawguess_word_packs WHERE id = ?')
        .bind(second.id)
        .first(),
    ).toEqual({ status: 'reserved' });
    await publishDrawGuessWordPack(env.DB, second, candidates, [reviewPayload]);
    await publishDrawGuessWordPack(env.DB, second, candidates, [reviewPayload]);
    expect(
      await env.DB.prepare('SELECT word, pinyin_initials, status FROM drawguess_words').first(),
    ).toEqual({ word: '大熊猫', pinyin_initials: 'd x m', status: 'active' });
  });

  it('keeps rejected candidates out of the word inventory', async () => {
    const pack = await reserveDrawGuessWordPack(env.DB, '2026-09-01', 0);
    if (pack === null) throw new Error('Expected reservation');
    const candidate: DrawGuessWordCandidate = {
      word: '云朵',
      category: pack.category,
      difficulty: 'easy',
      potentialIssues: [],
    };
    await storeDrawGuessWordCandidates(env.DB, pack, [candidate]);
    const candidates = await getDrawGuessReviewCandidates(env.DB, pack);
    expect(candidates).toHaveLength(1);
    await publishDrawGuessWordPack(env.DB, pack, candidates, [
      {
        word: candidate.word,
        qualityChecks: {
          isConcreteAndDrawable: false,
          isSimplifiedChinese: true,
          isLengthValid: true,
          isCategoryAccurate: true,
          isAppropriate: true,
          isUnambiguous: true,
        },
        reason: '形状过于抽象，没有明确画法。',
      },
    ]);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM drawguess_words').first()).toEqual({
      count: 0,
    });
    expect(await env.DB.prepare('SELECT status FROM drawguess_word_candidates').first()).toEqual({
      status: 'rejected',
    });
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
