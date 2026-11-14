/** Editorial-only DrawGuess word material; review records never enter room snapshots. */
import {
  DRAWGUESS_WORD_CATEGORIES,
  type DrawGuessWordCategory,
} from '@game-judge/game-engine/games/drawguess/public';
import { Converter } from 'opencc-js/t2cn';
import { pinyin } from 'pinyin-pro';
import { z } from 'zod';

import { type AiContext, AiOutputValidationError } from '../../platform/ai/aiError';
import { parseGeneratedCandidateBatch } from '../../platform/wordSupply/generatedCandidates';

export const DRAWGUESS_WORD_BATCH_LIMIT = 5;
export const DRAWGUESS_WORD_PROMPT_VERSION = 'drawguess-generation-v3';
export const DRAWGUESS_WORD_REVIEW_VERSION = 'drawguess-review-v3';
// Existing workflow checkpoints and published packs can contain up to 30 items.
const STORED_BATCH_LIMIT = 30;

const toSimplified = Converter({ from: 't', to: 'cn' });
/** 2–8 个汉字（CJK 主体区 + 扩展 A），只收简体。 */
const wordSchema = z
  .string()
  .trim()
  .min(2)
  .max(8)
  .regex(/^[\u3400-\u4dbf\u4e00-\u9fff]+$/);
const explanationSchema = z.string().trim().min(2).max(180);
const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const drawGuessCandidateSchema = z.strictObject({
  word: wordSchema,
  category: z.enum(DRAWGUESS_WORD_CATEGORIES),
  difficulty: difficultySchema,
  potentialIssues: z.array(explanationSchema).max(4),
});
export type DrawGuessWordCandidate = z.output<typeof drawGuessCandidateSchema>;
export const drawGuessCandidatesSchema = z.strictObject({
  candidates: z.array(drawGuessCandidateSchema).max(DRAWGUESS_WORD_BATCH_LIMIT),
});

const qualityChecksSchema = z.strictObject({
  isConcreteAndDrawable: z.boolean(),
  isSimplifiedChinese: z.boolean(),
  isLengthValid: z.boolean(),
  isCategoryAccurate: z.boolean(),
  isAppropriate: z.boolean(),
  isUnambiguous: z.boolean(),
});
export const drawGuessReviewsSchema = z.strictObject({
  reviews: z
    .array(
      z.strictObject({
        word: wordSchema,
        reason: explanationSchema,
        qualityChecks: qualityChecksSchema,
      }),
    )
    .max(DRAWGUESS_WORD_BATCH_LIMIT),
});
export type DrawGuessWordReview = z.output<typeof drawGuessReviewsSchema>['reviews'][number];

/** 繁简归一 + NFKC，与出题时的归一口径一致。 */
function canonicalizeDrawGuessWord(word: string): string {
  return wordSchema.parse(toSimplified(word.normalize('NFKC')).trim());
}

/** Stable identity is the canonical word alone; pinyin/category never affect identity. */
export async function getDrawGuessWordId(word: string): Promise<string> {
  const canonical = canonicalizeDrawGuessWord(word);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `drawguess:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 逐字取拼音提示，空格分隔（如 "d x m"、"ch q")。
 * 有声母的字取声母；零声母字（鹅、安、尔等）没有声母，取拼音的第一个字母（"企鹅" → "q e"）。
 * 多音字取拼音库默认常用读音；解析异常的字直接抛错，由发布环节判为不合格。
 * 注意：声母有双字母（zh/ch/sh），所以按空格切分后的段数才与字数相等。
 */
export function toPinyinInitials(word: string): string {
  const canonical = canonicalizeDrawGuessWord(word);
  const consonants = pinyin(canonical, { pattern: 'initial', toneType: 'none', type: 'array' });
  const firstLetters = pinyin(canonical, { pattern: 'first', toneType: 'none', type: 'array' });
  const initials = consonants.map((consonant, index) =>
    consonant.length > 0 ? consonant : (firstLetters[index] ?? ''),
  );
  if (initials.length !== [...canonical].length) {
    throw new AiOutputValidationError(
      'pinyinInitialsMismatch',
      `DrawGuess 拼音首字母数量与字数不符: ${canonical}`,
    );
  }
  if (!initials.every((part) => /^[a-z]+$/.test(part))) {
    throw new AiOutputValidationError(
      'invalidPinyinInitials',
      `DrawGuess 拼音首字母含非法字符: ${canonical}`,
    );
  }
  return initials.join(' ');
}

function normalizeDrawGuessCandidate(
  candidate: DrawGuessWordCandidate,
  category: DrawGuessWordCategory,
): DrawGuessWordCandidate {
  if (candidate.category !== category)
    throw new AiOutputValidationError('categoryMismatch', 'DrawGuess generated category mismatch', [
      'category',
    ]);
  return { ...candidate, word: canonicalizeDrawGuessWord(candidate.word) };
}

/** Only model generation may reject individual candidates and return a validation summary. */
export function decodeGeneratedDrawGuessCandidates(
  value: unknown,
  category: DrawGuessWordCategory,
  context: AiContext,
) {
  return parseGeneratedCandidateBatch(value, {
    limit: DRAWGUESS_WORD_BATCH_LIMIT,
    context,
    parseCandidate: (item) =>
      normalizeDrawGuessCandidate(drawGuessCandidateSchema.parse(item), category),
    getIdentity: ({ word }) => word,
  });
}

/** Strictly validate all material before storage, then remove batch duplicates. */
export function parseDrawGuessCandidates(
  value: unknown,
  category: DrawGuessWordCategory,
): DrawGuessWordCandidate[] {
  const seen = new Set<string>();
  const { candidates } = drawGuessCandidatesSchema
    .extend({ candidates: z.array(drawGuessCandidateSchema).max(STORED_BATCH_LIMIT) })
    .parse(value);
  return candidates.flatMap((item) => {
    const candidate = normalizeDrawGuessCandidate(item, category);
    if (seen.has(candidate.word)) return [];
    seen.add(candidate.word);
    return [candidate];
  });
}

/** Reviews must cover the exact ordered candidates, never silently omit or substitute. */
export function parseDrawGuessReviews(
  value: unknown,
  candidates: readonly DrawGuessWordCandidate[],
): DrawGuessWordReview[] {
  const { reviews } = drawGuessReviewsSchema
    .extend({
      reviews: z.array(drawGuessReviewsSchema.shape.reviews.element).max(STORED_BATCH_LIMIT),
    })
    .parse(value);
  if (reviews.length !== candidates.length)
    throw new AiOutputValidationError('reviewCountMismatch', 'DrawGuess review count mismatch');
  return reviews.map((review, index) => {
    const candidate = candidates[index];
    const word = canonicalizeDrawGuessWord(review.word);
    if (candidate === undefined || word !== candidate.word)
      throw new AiOutputValidationError('reviewIdentityMismatch', 'DrawGuess review word mismatch');
    return { ...review, word };
  });
}

/** Every quality check must pass; uncertainty in any single check rejects the word. */
export function isDrawGuessReviewAccepted(review: DrawGuessWordReview): boolean {
  return Object.values(review.qualityChecks).every(Boolean);
}
