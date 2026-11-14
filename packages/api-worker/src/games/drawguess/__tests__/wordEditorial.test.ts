/** Word identity, pinyin derivation, and exact independent review contracts. */
import { describe, expect, it } from 'vitest';

import {
  getDrawGuessWordId,
  isDrawGuessReviewAccepted,
  parseDrawGuessCandidates,
  parseDrawGuessReviews,
  toPinyinInitials,
} from '../wordEditorial';

const candidate = {
  word: '大熊猫',
  category: 'animals',
  difficulty: 'easy',
  potentialIssues: [],
} as const;
const review = {
  word: '大熊猫',
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

describe('DrawGuess editorial contracts', () => {
  it('still reads complete 30-word stored packs and their old-order reviews', () => {
    const material = Array.from({ length: 30 }, (_, index) => ({
      ...candidate,
      word: `测试${String.fromCodePoint(0x4e00 + index)}`,
    }));
    const parsed = parseDrawGuessCandidates({ candidates: material }, 'animals');
    const reviews = parsed.map(({ word }) => ({ ...review, word }));
    expect(parsed).toHaveLength(30);
    expect(parseDrawGuessReviews({ reviews }, parsed)).toEqual(reviews);
    expect(() =>
      parseDrawGuessReviews({ reviews: [...reviews, ...reviews.slice(0, 1)] }, [
        ...parsed,
        ...parsed.slice(0, 1),
      ]),
    ).toThrow();
    expect(() =>
      parseDrawGuessCandidates({ candidates: [...material, candidate] }, 'animals'),
    ).toThrow();
  });

  it('keeps strict batch parsing for stored material even when another candidate is valid', () => {
    expect(() =>
      parseDrawGuessCandidates(
        {
          candidates: [candidate, { ...candidate, word: 'bad!' }],
        },
        'animals',
      ),
    ).toThrow();
  });

  it('derives identity from the canonical simplified word alone', async () => {
    expect(await getDrawGuessWordId('大熊貓')).toBe(await getDrawGuessWordId('大熊猫'));
    const parsed = parseDrawGuessCandidates(
      { candidates: [candidate, { ...candidate, word: '大熊貓' }] },
      'animals',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.word).toBe('大熊猫');
    expect(() => parseDrawGuessCandidates({ candidates: [candidate] }, 'food')).toThrow('category');
  });

  it('derives space-separated pinyin initials per character', () => {
    expect(toPinyinInitials('大熊猫')).toBe('d x m');
    expect(toPinyinInitials('自行车')).toBe('z x ch');
  });

  it('hints a zero-initial character with the first letter of its pinyin', () => {
    expect(toPinyinInitials('企鹅')).toBe('q e');
    expect(toPinyinInitials('埃菲尔铁塔')).toBe('a f e t t');
    expect(toPinyinInitials('安全屋')).toBe('a q w');
  });

  it('requires exact review coverage and rejects any failed quality check', () => {
    const candidates = parseDrawGuessCandidates({ candidates: [candidate] }, 'animals');
    expect(parseDrawGuessReviews({ reviews: [review] }, candidates)).toHaveLength(1);
    expect(() => parseDrawGuessReviews({ reviews: [] }, candidates)).toThrow('count');
    expect(() =>
      parseDrawGuessReviews({ reviews: [{ ...review, word: '长颈鹿' }] }, candidates),
    ).toThrow('word');
    expect(isDrawGuessReviewAccepted(review)).toBe(true);
    expect(
      isDrawGuessReviewAccepted({
        ...review,
        qualityChecks: { ...review.qualityChecks, isUnambiguous: false },
      }),
    ).toBe(false);
  });
});
