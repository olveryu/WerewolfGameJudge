/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordSource,
  isValidFibDefinitionField,
  isValidFibWord,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { sha256Hex } from '../../../platform/crypto/sha256Hex';
import {
  FIB_GENERATED_WORD_CANDIDATE_COUNT,
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordRequest,
} from './types';

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

const generatedFibWordCandidatesPayloadSchema = z.strictObject({
  candidates: z
    .array(generatedFibWordCandidatePayloadSchema)
    .length(FIB_GENERATED_WORD_CANDIDATE_COUNT),
});

export const FIB_WORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['word', 'definition', 'category'],
  properties: {
    word: {
      type: 'string',
      description: `${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个纯汉字组成的中文词语或多字概念`,
    },
    definition: {
      type: 'object',
      additionalProperties: false,
      required: ['coreMeaning', 'usageNote'],
      properties: {
        coreMeaning: {
          type: 'string',
          description: '准确说明词语核心含义的完整中文句子，不得含英文字母',
        },
        usageNote: {
          type: 'string',
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

export const FIB_WORD_CANDIDATES_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      description: `按出题质量从高到低排列的${FIB_GENERATED_WORD_CANDIDATE_COUNT}个候选`,
      minItems: FIB_GENERATED_WORD_CANDIDATE_COUNT,
      maxItems: FIB_GENERATED_WORD_CANDIDATE_COUNT,
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

export function selectGeneratedFibWordCandidate(
  value: unknown,
  source: FibWordSource,
  request: FibWordRequest,
): FibWordCandidate {
  const payload = generatedFibWordCandidatesPayloadSchema.parse(value);
  assertDistinctCandidates(payload.candidates);
  for (const candidate of payload.candidates) {
    if (candidate.category !== request.category) {
      throw new Error(
        `Fib word provider ${source} returned category ${candidate.category}, expected ${request.category}`,
      );
    }
  }
  const avoidedWords = new Set(request.avoidWords);
  const recentWords = new Set(request.recentWords);
  const selected = payload.candidates.find(
    (candidate) => !avoidedWords.has(candidate.word) && !recentWords.has(candidate.word),
  );
  if (selected === undefined) {
    throw new Error(`Fib word provider ${source} returned no eligible candidate`);
  }
  return { word: selected.word, definition: selected.definition, source };
}

export function selectLocalFibWordCandidate(
  values: readonly unknown[],
  request: FibWordRequest,
): Promise<FibWordCandidate> {
  const candidates = values.map((value) => fibWordCandidatePayloadSchema.parse(value));
  assertDistinctCandidates(candidates);
  return selectCandidate(candidates, 'local', request, true);
}
