/** Real D1 queue recovery, exact review publication with pinyin, and stable retirement. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

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
  it('resumes failed material and publishes once with pinyin initials', async () => {
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
