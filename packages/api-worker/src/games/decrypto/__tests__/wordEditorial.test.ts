import { describe, expect, it } from 'vitest';

import {
  getDecryptoWordId,
  isDecryptoReviewAccepted,
  parseDecryptoCandidates,
  parseDecryptoReviews,
} from '../wordEditorial';

describe('Decrypto word editorial', () => {
  it('canonicalizes and deduplicates words before submission', () => {
    const candidates = parseDecryptoCandidates(
      {
        candidates: [
          { word: '  大象 ', category: 'general', potentialIssues: [] },
          { word: '大象', category: 'general', potentialIssues: [] },
        ],
      },
      'general',
    );
    expect(candidates).toEqual([{ word: '大象', category: 'general', potentialIssues: [] }]);
  });

  it('uses stable identity and rejects reviews that substitute a word', async () => {
    expect(await getDecryptoWordId('大象')).toBe(await getDecryptoWordId(' 大象 '));
    const candidate = { word: '大象', category: 'general' as const, potentialIssues: [] };
    expect(() =>
      parseDecryptoReviews(
        {
          reviews: [
            {
              word: '老虎',
              reason: '词语清晰。',
              qualityChecks: {
                isFamiliar: true,
                isConcrete: true,
                isUnambiguous: true,
                isAppropriate: true,
              },
            },
          ],
        },
        [candidate],
      ),
    ).toThrow('Decrypto review word mismatch');
  });

  it('requires every quality check to pass', () => {
    const review = {
      word: '大象',
      reason: '常见且具体。',
      qualityChecks: {
        isFamiliar: true,
        isConcrete: true,
        isUnambiguous: true,
        isAppropriate: true,
      },
    };
    expect(isDecryptoReviewAccepted(review)).toBe(true);
    expect(
      isDecryptoReviewAccepted({
        ...review,
        qualityChecks: { ...review.qualityChecks, isUnambiguous: false },
      }),
    ).toBe(false);
  });
});
