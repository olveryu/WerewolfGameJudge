/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordSource,
  isValidFibDefinitionField,
  isValidFibWord,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import {
  FIB_GENERATED_WORD_CANDIDATE_COUNT,
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordRequest,
  type FibWordReview,
} from './types';

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

const fibWordReviewsPayloadSchema = z.strictObject({
  reviews: z
    .array(
      z.strictObject({
        word: generatedFibWordSchema,
        qualityChecks: z.strictObject({
          isEstablishedTerm: z.boolean(),
          isDefinitionAccurate: z.boolean(),
          isEasyToReadAloud: z.boolean(),
          isMeaningUnfamiliarToMostPlayers: z.boolean(),
          isMeaningDistinctFromLiteralReading: z.boolean(),
          hasMultiplePlausibleWrongDefinitions: z.boolean(),
          hasRevealValue: z.boolean(),
        }),
        reason: z.string().trim().min(8).max(100),
      }),
    )
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

export const FIB_WORD_REVIEWS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      minItems: FIB_GENERATED_WORD_CANDIDATE_COUNT,
      maxItems: FIB_GENERATED_WORD_CANDIDATE_COUNT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'qualityChecks', 'reason'],
        properties: {
          word: { type: 'string', description: '与输入候选完全一致的词语' },
          qualityChecks: {
            type: 'object',
            additionalProperties: false,
            required: [
              'isEstablishedTerm',
              'isDefinitionAccurate',
              'isEasyToReadAloud',
              'isMeaningUnfamiliarToMostPlayers',
              'isMeaningDistinctFromLiteralReading',
              'hasMultiplePlausibleWrongDefinitions',
              'hasRevealValue',
            ],
            properties: {
              isEstablishedTerm: {
                type: 'boolean',
                description: '是否为已有固定含义的真实词项，而非临时短语或自造词',
              },
              isDefinitionAccurate: {
                type: 'boolean',
                description: '核心释义是否真实准确且没有混入错误义项',
              },
              isEasyToReadAloud: {
                type: 'boolean',
                description: '多数普通玩家是否能自然认读并口述词面',
              },
              isMeaningUnfamiliarToMostPlayers: {
                type: 'boolean',
                description: '多数普通玩家是否无法在揭晓前准确说出固定真义',
              },
              isMeaningDistinctFromLiteralReading: {
                type: 'boolean',
                description: '逐字理解或词面意象是否无法推出接近标准释义的答案',
              },
              hasMultiplePlausibleWrongDefinitions: {
                type: 'boolean',
                description: '是否容易编造至少两种彼此不同且可信的错误释义',
              },
              hasRevealValue: {
                type: 'boolean',
                description: '真义揭晓后是否具有反差或讨论价值',
              },
            },
          },
          reason: { type: 'string', description: '具体说明接受或拒绝依据的中文句子' },
        },
      },
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

export function parseGeneratedFibWordCandidates(
  value: unknown,
  source: FibWordSource,
  request: FibWordRequest,
): readonly FibWordCandidate[] {
  const payload = generatedFibWordCandidatesPayloadSchema.parse(value);
  assertDistinctCandidates(payload.candidates);
  for (const candidate of payload.candidates) {
    if (candidate.category !== request.category) {
      throw new Error(
        `Fib word provider ${source} returned category ${candidate.category}, expected ${request.category}`,
      );
    }
  }
  return payload.candidates.map(({ word, definition }) => ({ word, definition, source }));
}

export function parseFibWordReviews(
  value: unknown,
  candidates: readonly FibWordCandidate[],
): readonly FibWordReview[] {
  if (candidates.length !== FIB_GENERATED_WORD_CANDIDATE_COUNT) {
    throw new Error(
      `Fib word review received ${candidates.length} candidates instead of ${FIB_GENERATED_WORD_CANDIDATE_COUNT}`,
    );
  }
  const payload = fibWordReviewsPayloadSchema.parse(value);
  assertDistinctCandidates(payload.reviews);
  for (const [index, review] of payload.reviews.entries()) {
    const candidate = candidates[index];
    if (candidate === undefined || review.word !== candidate.word) {
      throw new Error(`Fib word review did not preserve candidate order at index ${index}`);
    }
  }
  return payload.reviews.map(({ word, qualityChecks, reason }) => ({
    word,
    qualityChecks,
    decision:
      qualityChecks.isEstablishedTerm &&
      qualityChecks.isDefinitionAccurate &&
      qualityChecks.isEasyToReadAloud &&
      qualityChecks.isMeaningUnfamiliarToMostPlayers &&
      qualityChecks.isMeaningDistinctFromLiteralReading &&
      qualityChecks.hasMultiplePlausibleWrongDefinitions &&
      qualityChecks.hasRevealValue
        ? 'accepted'
        : 'rejected',
    reason,
  }));
}
