/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_DEFINITION_MAX_LENGTH,
  FIB_DEFINITION_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordSource,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { sha256Hex } from '../../../platform/crypto/sha256Hex';
import {
  FIB_WORD_CANDIDATE_COUNT,
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordCategory,
  type FibWordRequest,
} from './types';

const SELECTION_HASH_HEX_LENGTH = 8;
const generatedFibWordSchema = z
  .string()
  .trim()
  .min(FIB_WORD_MIN_LENGTH)
  .max(FIB_WORD_MAX_LENGTH)
  .regex(/^[\p{L}\p{N}·+&/ -]+$/u);

const fibWordCandidatePayloadSchema = z.strictObject({
  word: z.string().trim().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH),
  definition: z.string().trim().min(FIB_DEFINITION_MIN_LENGTH).max(FIB_DEFINITION_MAX_LENGTH),
});

const generatedFibWordCandidatePayloadSchema = fibWordCandidatePayloadSchema.extend({
  word: generatedFibWordSchema,
});

const categorizedFibWordCandidatePayloadSchema = generatedFibWordCandidatePayloadSchema.extend({
  category: z.enum(FIB_WORD_CATEGORIES),
});

const fibWordCandidateBatchPayloadSchema = z.strictObject({
  candidates: z.array(categorizedFibWordCandidatePayloadSchema).length(FIB_WORD_CANDIDATE_COUNT),
});

const FIB_WORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['word', 'definition', 'category'],
  properties: {
    word: {
      type: 'string',
      description: `${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}字符的中文词语、网络用语或多字概念，可含汉字、字母或数字`,
    },
    definition: {
      type: 'string',
      description: `${FIB_DEFINITION_MIN_LENGTH}-${FIB_DEFINITION_MAX_LENGTH}字的准确简洁中文释义`,
    },
    category: {
      type: 'string',
      enum: FIB_WORD_CATEGORIES,
      description: '候选类别',
    },
  },
} as const;

export const FIB_WORD_BATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      minItems: FIB_WORD_CANDIDATE_COUNT,
      maxItems: FIB_WORD_CANDIDATE_COUNT,
      items: FIB_WORD_JSON_SCHEMA,
    },
  },
} as const;

function assertDistinctCandidates(candidates: readonly { readonly word: string }[]): void {
  const words = new Set<string>();
  for (const candidate of candidates) {
    if (words.has(candidate.word)) {
      throw new Error(`Fib word provider returned duplicate candidate: ${candidate.word}`);
    }
    words.add(candidate.word);
  }
}

function assertCompleteCategories(
  candidates: readonly { readonly category: FibWordCategory }[],
): void {
  const categories = new Set(candidates.map((candidate) => candidate.category));
  for (const category of FIB_WORD_CATEGORIES) {
    if (!categories.has(category)) {
      throw new Error(`Fib word provider omitted candidate category: ${category}`);
    }
  }
}

async function selectCandidate(
  candidates: readonly z.output<typeof generatedFibWordCandidatePayloadSchema>[],
  source: FibWordSource,
  request: FibWordRequest,
  allowRecentWordFallback: boolean,
): Promise<FibWordCandidate> {
  if (request.selectionSeed.length === 0) {
    throw new Error('Fib word selection seed must be non-empty');
  }
  const avoidedWords = new Set(request.avoidWords);
  const recentWords = new Set(request.recentWords);
  const unseenCandidates = candidates.filter(
    (candidate) => !avoidedWords.has(candidate.word) && !recentWords.has(candidate.word),
  );
  const eligibleCandidates =
    unseenCandidates.length > 0 || !allowRecentWordFallback
      ? unseenCandidates
      : candidates.filter((candidate) => !avoidedWords.has(candidate.word));
  if (eligibleCandidates.length === 0) {
    throw new Error(`Fib word provider ${source} returned no eligible candidate`);
  }
  const selectionHash = await sha256Hex(request.selectionSeed);
  const selectionValue = Number.parseInt(selectionHash.slice(0, SELECTION_HASH_HEX_LENGTH), 16);
  const selected = eligibleCandidates[selectionValue % eligibleCandidates.length];
  if (selected === undefined) {
    throw new Error('[FAIL-FAST] Fib word candidate selection produced no value');
  }
  return { word: selected.word, definition: selected.definition, source };
}

export function parseFibWordCandidate(
  value: unknown,
  source: FibWordSource,
  avoidWords: readonly string[],
): FibWordCandidate {
  const payload = fibWordCandidatePayloadSchema.parse(value);
  if (avoidWords.includes(payload.word)) {
    throw new Error(`Fib word provider ${source} returned an avoided word: ${payload.word}`);
  }
  return { ...payload, source };
}

export function parseFibWordCandidateBatch(
  value: unknown,
  source: FibWordSource,
  request: FibWordRequest,
): Promise<FibWordCandidate> {
  const payload = fibWordCandidateBatchPayloadSchema.parse(value);
  assertDistinctCandidates(payload.candidates);
  assertCompleteCategories(payload.candidates);
  return selectCandidate(payload.candidates, source, request, false);
}

export function parseFibWordCandidateBatchJson(
  value: string,
  source: FibWordSource,
  request: FibWordRequest,
): Promise<FibWordCandidate> {
  return parseFibWordCandidateBatch(JSON.parse(value), source, request);
}

export function selectLocalFibWordCandidate(
  values: readonly unknown[],
  request: FibWordRequest,
): Promise<FibWordCandidate> {
  const candidates = values.map((value) => generatedFibWordCandidatePayloadSchema.parse(value));
  assertDistinctCandidates(candidates);
  return selectCandidate(candidates, 'local', request, true);
}
