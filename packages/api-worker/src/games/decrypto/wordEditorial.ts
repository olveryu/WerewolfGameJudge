/** Editorial-only Decrypto words; review evidence never enters room snapshots. */
import {
  DECRYPTO_WORD_CATEGORIES,
  type DecryptoWordCategory,
} from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import { type AiContext, AiOutputValidationError } from '../../platform/ai/aiError';
import { parseGeneratedCandidateBatch } from '../../platform/wordSupply/generatedCandidates';

export const DECRYPTO_WORD_BATCH_LIMIT = 1;
export const DECRYPTO_WORD_PROMPT_VERSION = 'decrypto-generation-v2';
export const DECRYPTO_WORD_REVIEW_VERSION = 'decrypto-review-v1';
const STORED_BATCH_LIMIT = 30;

const wordSchema = z
  .string()
  .trim()
  .min(2)
  .max(8)
  .regex(/^[\u3400-\u4dbf\u4e00-\u9fff]+$/);
const explanationSchema = z.string().trim().min(2).max(180);

export const decryptoCandidateSchema = z.strictObject({
  word: wordSchema,
  category: z.enum(DECRYPTO_WORD_CATEGORIES),
  potentialIssues: z.array(explanationSchema).max(4),
});
export type DecryptoWordCandidate = z.output<typeof decryptoCandidateSchema>;
export const decryptoCandidatesSchema = z.strictObject({
  candidates: z.array(decryptoCandidateSchema).max(DECRYPTO_WORD_BATCH_LIMIT),
});

const qualityChecksSchema = z.strictObject({
  isFamiliar: z.boolean(),
  isConcrete: z.boolean(),
  isUnambiguous: z.boolean(),
  isAppropriate: z.boolean(),
});
export const decryptoReviewsSchema = z.strictObject({
  reviews: z
    .array(
      z.strictObject({
        word: wordSchema,
        reason: explanationSchema,
        qualityChecks: qualityChecksSchema,
      }),
    )
    .max(DECRYPTO_WORD_BATCH_LIMIT),
});
export type DecryptoWordReview = z.output<typeof decryptoReviewsSchema>['reviews'][number];

function canonicalizeWord(word: string): string {
  return wordSchema.parse(word.normalize('NFKC').trim());
}

/** Stable identity is the canonical word alone; category and review do not affect it. */
export async function getDecryptoWordId(word: string): Promise<string> {
  const canonical = canonicalizeWord(word);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `decrypto:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeCandidate(
  candidate: DecryptoWordCandidate,
  category: DecryptoWordCategory,
): DecryptoWordCandidate {
  if (candidate.category !== category)
    throw new AiOutputValidationError('categoryMismatch', 'Decrypto generated category mismatch', [
      'category',
    ]);
  return { ...candidate, word: canonicalizeWord(candidate.word) };
}

/** Only model generation may reject individual words and return a validation summary. */
export function decodeGeneratedDecryptoCandidates(
  value: unknown,
  category: DecryptoWordCategory,
  context: AiContext,
) {
  return parseGeneratedCandidateBatch(value, {
    limit: DECRYPTO_WORD_BATCH_LIMIT,
    context,
    parseCandidate: (item) => normalizeCandidate(decryptoCandidateSchema.parse(item), category),
    getIdentity: ({ word }) => word,
  });
}

/** Strictly validate material before storage and remove duplicates within the batch. */
export function parseDecryptoCandidates(
  value: unknown,
  category: DecryptoWordCategory,
): DecryptoWordCandidate[] {
  const seen = new Set<string>();
  const { candidates } = decryptoCandidatesSchema
    .extend({ candidates: z.array(decryptoCandidateSchema).max(STORED_BATCH_LIMIT) })
    .parse(value);
  return candidates.flatMap((item) => {
    const candidate = normalizeCandidate(item, category);
    if (seen.has(candidate.word)) return [];
    seen.add(candidate.word);
    return [candidate];
  });
}

/** Reviews must cover the exact ordered candidates, never silently omit or substitute a word. */
export function parseDecryptoReviews(
  value: unknown,
  candidates: readonly DecryptoWordCandidate[],
): DecryptoWordReview[] {
  const { reviews } = decryptoReviewsSchema
    .extend({
      reviews: z.array(decryptoReviewsSchema.shape.reviews.element).max(STORED_BATCH_LIMIT),
    })
    .parse(value);
  if (reviews.length !== candidates.length)
    throw new AiOutputValidationError('reviewCountMismatch', 'Decrypto review count mismatch');
  return reviews.map((review, index) => {
    const candidate = candidates[index];
    const word = canonicalizeWord(review.word);
    if (candidate === undefined || word !== candidate.word)
      throw new AiOutputValidationError('reviewIdentityMismatch', 'Decrypto review word mismatch');
    return { ...review, word };
  });
}

export function isDecryptoReviewAccepted(review: DecryptoWordReview): boolean {
  return Object.values(review.qualityChecks).every(Boolean);
}
