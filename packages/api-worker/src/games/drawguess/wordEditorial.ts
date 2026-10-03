/** Editorial-only DrawGuess word material; review records never enter room snapshots. */
import {
  DRAWGUESS_WORD_CATEGORIES,
  type DrawGuessWordCategory,
} from '@game-judge/game-engine/games/drawguess/public';
import { Converter } from 'opencc-js/t2cn';
import { pinyin } from 'pinyin-pro';
import { z } from 'zod';

export const DRAWGUESS_WORD_BATCH_LIMIT = 30;
export const DRAWGUESS_WORD_PROMPT_VERSION = 'drawguess-generation-v1';
export const DRAWGUESS_WORD_REVIEW_VERSION = 'drawguess-review-v1';

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

const drawGuessCandidateSchema = z.strictObject({
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
        qualityChecks: qualityChecksSchema,
        reason: explanationSchema,
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
 * 逐字取拼音首字母，空格分隔（如 "d x m"、"ch q")。
 * 多音字取拼音库默认常用读音；无声母或解析异常的字直接抛错，由发布环节判为不合格。
 * 注意：声母有双字母（zh/ch/sh），所以按空格切分后的段数才与字数相等。
 */
export function toPinyinInitials(word: string): string {
  const canonical = canonicalizeDrawGuessWord(word);
  const initials = pinyin(canonical, { pattern: 'initial', toneType: 'none' })
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (initials.length !== [...canonical].length) {
    throw new Error(`DrawGuess 拼音首字母数量与字数不符: ${canonical}`);
  }
  if (!initials.every((part) => /^[a-z]+$/.test(part))) {
    throw new Error(`DrawGuess 拼音首字母含非法字符: ${canonical}`);
  }
  return initials.join(' ');
}

/** Validate all generated material before storage, then remove batch duplicates. */
export function parseDrawGuessCandidates(
  value: unknown,
  category: DrawGuessWordCategory,
): DrawGuessWordCandidate[] {
  const seen = new Set<string>();
  return drawGuessCandidatesSchema.parse(value).candidates.flatMap((candidate) => {
    if (candidate.category !== category) throw new Error('DrawGuess generated category mismatch');
    const word = canonicalizeDrawGuessWord(candidate.word);
    if (seen.has(word)) return [];
    seen.add(word);
    return [{ ...candidate, word }];
  });
}

/** Reviews must cover the exact ordered candidates, never silently omit or substitute. */
export function parseDrawGuessReviews(
  value: unknown,
  candidates: readonly DrawGuessWordCandidate[],
): DrawGuessWordReview[] {
  const { reviews } = drawGuessReviewsSchema.parse(value);
  if (reviews.length !== candidates.length) throw new Error('DrawGuess review count mismatch');
  return reviews.map((review, index) => {
    const candidate = candidates[index];
    const word = canonicalizeDrawGuessWord(review.word);
    if (candidate === undefined || word !== candidate.word)
      throw new Error('DrawGuess review word mismatch');
    return { ...review, word };
  });
}

/** Every quality check must pass; uncertainty in any single check rejects the word. */
export function isDrawGuessReviewAccepted(review: DrawGuessWordReview): boolean {
  return Object.values(review.qualityChecks).every(Boolean);
}
