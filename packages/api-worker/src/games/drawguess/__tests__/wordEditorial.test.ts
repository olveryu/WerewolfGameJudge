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
