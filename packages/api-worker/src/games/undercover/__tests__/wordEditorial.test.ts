/** Pair identity and exact independent review contracts. */
import { describe, expect, it } from 'vitest';

import {
  getUndercoverPairId,
  isUndercoverReviewAccepted,
  parseUndercoverCandidates,
  parseUndercoverReviews,
} from '../wordEditorial';

const candidate = {
  wordA: '牛奶',
  wordB: '豆浆',
  category: 'food',
  commonTraits: ['早餐常喝', '可热可冷'],
  differences: ['来源不同', '味道不同'],
  potentialIssues: [],
};
const review = {
  wordA: '牛奶',
  wordB: '豆浆',
  commonTraits: ['早餐饮料', '可以加糖'],
  differences: ['动植物来源', '蛋白质来源'],
  reason: '两种词语都常见，描述有共性也能区分。',
  qualityChecks: {
    isFamiliar: true,
    hasSimilarFamiliarity: true,
    hasSharedDescriptions: true,
    hasDistinctDescriptions: true,
    isNotSynonymOrSubset: true,
    isPlayableBothWays: true,
    isCategoryAccurate: true,
    isAppropriate: true,
    isFactuallyCertain: true,
  },
};

describe('Undercover editorial contracts', () => {
  it('deduplicates swapped and traditional words with a category-independent identity', async () => {
    const parsed = parseUndercoverCandidates(
      { candidates: [candidate, { ...candidate, wordA: '豆漿', wordB: '牛奶' }] },
      'food',
    );
    expect(parsed).toHaveLength(1);
    expect(await getUndercoverPairId('豆漿', '牛奶')).toBe(
      await getUndercoverPairId('牛奶', '豆浆'),
    );
    expect(() =>
      parseUndercoverCandidates({ candidates: [{ ...candidate, wordB: '牛奶' }] }, 'food'),
    ).toThrow('identical');
    expect(() => parseUndercoverCandidates({ candidates: [candidate] }, 'travel')).toThrow(
      'category',
    );
  });
  it('requires exact review coverage and rejects uncertain or unsupported approvals', () => {
    const candidates = parseUndercoverCandidates({ candidates: [candidate] }, 'food');
    expect(parseUndercoverReviews({ reviews: [review] }, candidates)).toHaveLength(1);
    expect(() => parseUndercoverReviews({ reviews: [] }, candidates)).toThrow('count');
    expect(() =>
      parseUndercoverReviews({ reviews: [{ ...review, wordA: '咖啡' }] }, candidates),
    ).toThrow('pair');
    expect(isUndercoverReviewAccepted(review)).toBe(true);
    expect(
      isUndercoverReviewAccepted({
        ...review,
        qualityChecks: { ...review.qualityChecks, isFactuallyCertain: false },
      }),
    ).toBe(false);
    expect(isUndercoverReviewAccepted({ ...review, commonTraits: ['好喝', '好喝'] })).toBe(false);
  });
});
