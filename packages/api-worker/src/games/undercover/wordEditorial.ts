/** Editorial-only pair material; descriptions and review evidence never enter room snapshots. */
import {
  UNDERCOVER_CATEGORIES,
  type UndercoverCategory,
} from '@game-judge/game-engine/games/undercover/public';
import { Converter } from 'opencc-js/t2cn';
import { z } from 'zod';

import { type AiContext, AiOutputValidationError } from '../../platform/ai/aiError';
import { parseGeneratedCandidateBatch } from '../../platform/wordSupply/generatedCandidates';

export const UNDERCOVER_WORD_BATCH_LIMIT = 30;
export const UNDERCOVER_WORD_PROMPT_VERSION = 'undercover-generation-v3';
export const UNDERCOVER_WORD_REVIEW_VERSION = 'undercover-review-v2';
const toSimplified = Converter({ from: 't', to: 'cn' });
const wordSchema = z.string().trim().min(1).max(16);
const explanationSchema = z.string().trim().min(2).max(180);

export const undercoverCandidateSchema = z.strictObject({
  wordA: wordSchema,
  wordB: wordSchema,
  category: z.enum(UNDERCOVER_CATEGORIES),
  commonTraits: z.array(explanationSchema).min(2).max(4),
  differences: z.array(explanationSchema).min(2).max(4),
  potentialIssues: z.array(explanationSchema).max(4),
});
export type UndercoverWordCandidate = z.output<typeof undercoverCandidateSchema>;
export const undercoverCandidatesSchema = z.strictObject({
  candidates: z.array(undercoverCandidateSchema).max(UNDERCOVER_WORD_BATCH_LIMIT),
});
const qualityChecksSchema = z.strictObject({
  isFamiliar: z.boolean(),
  hasSimilarFamiliarity: z.boolean(),
  hasSharedDescriptions: z.boolean(),
  hasDistinctDescriptions: z.boolean(),
  isNotSynonymOrSubset: z.boolean(),
  isPlayableBothWays: z.boolean(),
  isCategoryAccurate: z.boolean(),
  isAppropriate: z.boolean(),
  isFactuallyCertain: z.boolean(),
});
export const undercoverReviewsSchema = z.strictObject({
  reviews: z
    .array(
      z.strictObject({
        wordA: wordSchema,
        wordB: wordSchema,
        qualityChecks: qualityChecksSchema,
        commonTraits: z.array(explanationSchema).max(4),
        differences: z.array(explanationSchema).max(4),
        reason: explanationSchema,
      }),
    )
    .max(UNDERCOVER_WORD_BATCH_LIMIT),
});
export type UndercoverWordReview = z.output<typeof undercoverReviewsSchema>['reviews'][number];

/** Canonical order and orthography are independent of category and player-side assignment. */
function canonicalizeUndercoverPair(wordA: string, wordB: string) {
  const first = wordSchema.parse(toSimplified(wordA.normalize('NFKC')).trim().toLowerCase());
  const second = wordSchema.parse(toSimplified(wordB.normalize('NFKC')).trim().toLowerCase());
  if (first === second)
    throw new AiOutputValidationError('identicalWords', 'Undercover pair contains identical words');
  return first < second ? { wordA: first, wordB: second } : { wordA: second, wordB: first };
}

/** Stable identity excludes category, review version, and generated batch identifiers. */
export async function getUndercoverPairId(wordA: string, wordB: string): Promise<string> {
  const pair = canonicalizeUndercoverPair(wordA, wordB);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([pair.wordA, pair.wordB])),
  );
  return `undercover:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeUndercoverCandidate(
  candidate: UndercoverWordCandidate,
  category: UndercoverCategory,
): UndercoverWordCandidate {
  if (candidate.category !== category)
    throw new AiOutputValidationError(
      'categoryMismatch',
      'Undercover generated category mismatch',
      ['category'],
    );
  return { ...candidate, ...canonicalizeUndercoverPair(candidate.wordA, candidate.wordB) };
}

/** Only model generation may reject individual pairs and return a validation summary. */
export function decodeGeneratedUndercoverCandidates(
  value: unknown,
  category: UndercoverCategory,
  context: AiContext,
) {
  return parseGeneratedCandidateBatch(value, {
    limit: UNDERCOVER_WORD_BATCH_LIMIT,
    context,
    parseCandidate: (item) =>
      normalizeUndercoverCandidate(undercoverCandidateSchema.parse(item), category),
    getIdentity: ({ wordA, wordB }) => JSON.stringify([wordA, wordB]),
  });
}

/** Strictly validate all material before storage, then remove reversed batch duplicates. */
export function parseUndercoverCandidates(
  value: unknown,
  category: UndercoverCategory,
): UndercoverWordCandidate[] {
  const seen = new Set<string>();
  return undercoverCandidatesSchema.parse(value).candidates.flatMap((item) => {
    const candidate = normalizeUndercoverCandidate(item, category);
    const key = JSON.stringify([candidate.wordA, candidate.wordB]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [candidate];
  });
}

/** Reviews must cover the exact ordered candidates, never silently omit or substitute a pair. */
export function parseUndercoverReviews(
  value: unknown,
  candidates: readonly UndercoverWordCandidate[],
): UndercoverWordReview[] {
  const { reviews } = undercoverReviewsSchema.parse(value);
  if (reviews.length !== candidates.length)
    throw new AiOutputValidationError('reviewCountMismatch', 'Undercover review count mismatch');
  return reviews.map((review, index) => {
    const candidate = candidates[index];
    const pair = canonicalizeUndercoverPair(review.wordA, review.wordB);
    if (candidate === undefined || pair.wordA !== candidate.wordA || pair.wordB !== candidate.wordB)
      throw new AiOutputValidationError(
        'reviewIdentityMismatch',
        'Undercover review pair mismatch',
      );
    return { ...review, ...pair };
  });
}

/** Independent review must supply concrete shared and distinguishing descriptions to pass. */
export function isUndercoverReviewAccepted(review: UndercoverWordReview): boolean {
  return (
    Object.values(review.qualityChecks).every(Boolean) &&
    new Set(review.commonTraits).size >= 2 &&
    new Set(review.differences).size >= 2
  );
}
