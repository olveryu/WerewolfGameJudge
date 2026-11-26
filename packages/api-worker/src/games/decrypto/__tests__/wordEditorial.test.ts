import { describe, expect, it } from 'vitest';

import {
  getDecryptoWordId,
  isDecryptoReviewAccepted,
  parseDecryptoCandidates,
  parseDecryptoReviews,
} from '../wordEditorial';

describe('Decrypto word editorial', () => {
  it('rejects unknown categories and candidates from a different requested category', () => {
    expect(() =>
      parseDecryptoCandidates(
        {
          candidates: [{ word: '大象', category: 'unknown', potentialIssues: [] }],
        },
        'animals',
      ),
    ).toThrow();
    expect(() =>
      parseDecryptoCandidates(
        {
          candidates: [{ word: '樱花', category: 'plants', potentialIssues: [] }],
        },
        'animals',
      ),
    ).toThrow('Decrypto generated category mismatch');
  });

  it('canonicalizes and deduplicates words before submission', () => {
    const candidates = parseDecryptoCandidates(
      {
        candidates: [
          { word: '  大象 ', category: 'animals', potentialIssues: [] },
          { word: '大象', category: 'animals', potentialIssues: [] },
        ],
      },
      'animals',
    );
    expect(candidates).toEqual([{ word: '大象', category: 'animals', potentialIssues: [] }]);
  });

  it('uses stable identity and rejects reviews that substitute a word', async () => {
    expect(await getDecryptoWordId('大象')).toBe(await getDecryptoWordId(' 大象 '));
    const candidate = { word: '大象', category: 'animals' as const, potentialIssues: [] };
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
