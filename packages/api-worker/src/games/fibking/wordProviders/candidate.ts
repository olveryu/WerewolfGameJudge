/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordSource,
  isValidFibDefinitionField,
  isValidFibWord,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { sha256Hex } from '../../../platform/crypto/sha256Hex';
import { FIB_WORD_CATEGORIES, type FibWordCandidate, type FibWordRequest } from './types';

const SELECTION_HASH_HEX_LENGTH = 8;
const generatedFibWordSchema = z.string().trim().refine(isValidFibWord);
const fibDefinitionFieldSchema = z.string().trim().refine(isValidFibDefinitionField);
const fibWordDefinitionSchema = z.strictObject({
  coreMeaning: fibDefinitionFieldSchema,
  usageNote: fibDefinitionFieldSchema,
});

const fibWordCandidatePayloadSchema = z.strictObject({
  word: generatedFibWordSchema,
  definition: fibWordDefinitionSchema,
});

const generatedFibWordCandidatePayloadSchema = fibWordCandidatePayloadSchema.extend({
  category: z.enum(FIB_WORD_CATEGORIES),
});

export const FIB_WORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['word', 'definition', 'category'],
  properties: {
    word: {
      type: 'string',
      minLength: FIB_WORD_MIN_LENGTH,
      maxLength: FIB_WORD_MAX_LENGTH,
      description: `${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个纯汉字组成的中文词语或多字概念`,
    },
    definition: {
      type: 'object',
      additionalProperties: false,
      required: ['coreMeaning', 'usageNote'],
      properties: {
        coreMeaning: {
          type: 'string',
          minLength: FIB_DEFINITION_FIELD_MIN_LENGTH,
          maxLength: FIB_DEFINITION_FIELD_MAX_LENGTH,
          description: '准确说明词语核心含义的完整中文句子，不得含英文字母',
        },
        usageNote: {
          type: 'string',
          minLength: FIB_DEFINITION_FIELD_MIN_LENGTH,
          maxLength: FIB_DEFINITION_FIELD_MAX_LENGTH,
          description: '说明适用对象、语境或容易误解之处的完整中文句子，不得含英文字母',
        },
      },
    },
    category: {
      type: 'string',
      enum: FIB_WORD_CATEGORIES,
      description: '候选类别',
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

async function selectCandidate(
  candidates: readonly z.output<typeof fibWordCandidatePayloadSchema>[],
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

export function parseGeneratedFibWordCandidate(
  value: unknown,
  source: FibWordSource,
  request: FibWordRequest,
): FibWordCandidate {
  const payload = generatedFibWordCandidatePayloadSchema.parse(value);
  if (payload.category !== request.category) {
    throw new Error(
      `Fib word provider ${source} returned category ${payload.category}, expected ${request.category}`,
    );
  }
  if (request.avoidWords.includes(payload.word)) {
    throw new Error(`Fib word provider ${source} returned an avoided word: ${payload.word}`);
  }
  if (request.recentWords.includes(payload.word)) {
    throw new Error(`Fib word provider ${source} returned a recent word: ${payload.word}`);
  }
  return { word: payload.word, definition: payload.definition, source };
}

export function parseGeneratedFibWordCandidateJson(
  value: string,
  source: FibWordSource,
  request: FibWordRequest,
): FibWordCandidate {
  return parseGeneratedFibWordCandidate(JSON.parse(value), source, request);
}

export function selectLocalFibWordCandidate(
  values: readonly unknown[],
  request: FibWordRequest,
): Promise<FibWordCandidate> {
  const candidates = values.map((value) => fibWordCandidatePayloadSchema.parse(value));
  assertDistinctCandidates(candidates);
  return selectCandidate(candidates, 'local', request, true);
}
