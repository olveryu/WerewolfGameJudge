/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  FIB_WORD_SOURCES,
  type FibWordSource,
  isValidFibDefinitionField,
  isValidFibWord,
} from '@game-judge/game-engine/games/fibking/public';
import { Converter } from 'opencc-js/t2cn';
import { z } from 'zod';

import { FIB_WORD_EVIDENCE_SOURCE_LIMIT, fibWordEvidenceSchema } from './tavily';
import {
  FIB_WORD_CATEGORIES,
  FIB_WORD_GENERATION_BATCH_LIMIT,
  FIB_WORD_REVIEW_BATCH_LIMIT,
  type FibWordCandidate,
  type FibWordEditorialCandidate,
  type FibWordRequest,
  type FibWordReview,
} from './types';

const FIB_WORD_EVIDENCE_QUOTE_MIN_LENGTH = 8;
const FIB_WORD_EVIDENCE_QUOTE_MAX_LENGTH = 300;
const toSimplified = Converter({ from: 't', to: 'cn' });
const evidenceQuoteSchema = z
  .string()
  .trim()
  .min(FIB_WORD_EVIDENCE_QUOTE_MIN_LENGTH)
  .max(FIB_WORD_EVIDENCE_QUOTE_MAX_LENGTH);

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

const fibWordEditorialCandidateSchema = fibWordCandidatePayloadSchema.extend({
  category: z.enum(FIB_WORD_CATEGORIES),
  source: z.enum(FIB_WORD_SOURCES),
  evidence: z.array(fibWordEvidenceSchema).max(FIB_WORD_EVIDENCE_SOURCE_LIMIT),
});

const generatedFibWordCandidatePayloadSchema = fibWordCandidatePayloadSchema.extend({
  category: z.enum(FIB_WORD_CATEGORIES),
  citations: z
    .array(z.strictObject({ evidenceIndex: z.number().int().min(0), quote: evidenceQuoteSchema }))
    .min(1)
    .max(FIB_WORD_EVIDENCE_SOURCE_LIMIT),
});

const generatedFibWordCandidatesPayloadSchema = z.strictObject({
  candidates: z.array(generatedFibWordCandidatePayloadSchema).max(FIB_WORD_GENERATION_BATCH_LIMIT),
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
        evidenceIndex: z.number().int().min(0).nullable(),
        evidenceQuote: evidenceQuoteSchema.nullable(),
      }),
    )
    .max(FIB_WORD_REVIEW_BATCH_LIMIT),
});

export const FIB_WORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['word', 'definition', 'category', 'citations'],
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
    citations: {
      type: 'array',
      minItems: 1,
      maxItems: FIB_WORD_EVIDENCE_SOURCE_LIMIT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['evidenceIndex', 'quote'],
        properties: {
          evidenceIndex: { type: 'integer', minimum: 0, description: '输入资料数组的零起始下标' },
          quote: {
            type: 'string',
            minLength: FIB_WORD_EVIDENCE_QUOTE_MIN_LENGTH,
            maxLength: FIB_WORD_EVIDENCE_QUOTE_MAX_LENGTH,
            description:
              '支持该词释义的连续原文；词面须在同一资料中，引用不必重复词头。仅允许空白排版差异，不得改写或拼接',
          },
        },
      },
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
      description: `按证据明确程度和概念多样性排列，最多${FIB_WORD_GENERATION_BATCH_LIMIT}个真实候选，游戏性由后续审核判断`,
      minItems: 0,
      maxItems: FIB_WORD_GENERATION_BATCH_LIMIT,
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
      minItems: 1,
      maxItems: FIB_WORD_REVIEW_BATCH_LIMIT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['word', 'qualityChecks', 'reason', 'evidenceIndex', 'evidenceQuote'],
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
                description:
                  '多数普通玩家是否能借助界面提供的拼音口述词面，不要求原先认识汉字或知道读音',
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
          evidenceIndex: {
            type: ['integer', 'null'],
            minimum: 0,
            description: '该候选资料数组中支持核心释义的零起始下标；没有证据时为 null',
          },
          evidenceQuote: {
            type: ['string', 'null'],
            minLength: FIB_WORD_EVIDENCE_QUOTE_MIN_LENGTH,
            maxLength: FIB_WORD_EVIDENCE_QUOTE_MAX_LENGTH,
            description:
              '支持该词释义的连续原文，引用不必重复同一资料中的词头；没有证据时为 null 并拒绝该候选',
          },
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

/** Parse persisted editorial data without adding metadata to the runtime word contract. */
export function parseFibWordEditorialCandidate(value: unknown): FibWordEditorialCandidate {
  return fibWordEditorialCandidateSchema.parse(value);
}

function resolveFibWordEvidenceQuote(content: string, quote: string): string | null {
  const quotePattern = quote
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const match = content.match(new RegExp(quotePattern, 'u'));
  return match === null || match[0].length > FIB_WORD_EVIDENCE_QUOTE_MAX_LENGTH ? null : match[0];
}

function containsFibWord(content: string, word: string): boolean {
  return toSimplified(content).includes(toSimplified(word));
}

export function parseGeneratedFibWordCandidates(
  value: unknown,
  source: FibWordSource,
  request: FibWordRequest,
): readonly FibWordEditorialCandidate[] {
  const payload = generatedFibWordCandidatesPayloadSchema.parse(value);
  assertDistinctCandidates(payload.candidates);
  return payload.candidates.map(({ word, definition, category, citations }) => ({
    word,
    definition,
    category,
    source,
    evidence: citations.map(({ evidenceIndex, quote }) => {
      const evidence = request.evidence[evidenceIndex];
      if (
        evidence === undefined ||
        !containsFibWord(evidence.content, word) ||
        resolveFibWordEvidenceQuote(evidence.content, quote) === null
      ) {
        throw new Error(`Fib word candidate has an invalid evidence citation: ${word}`);
      }
      return evidence;
    }),
  }));
}

/** Validate literal provenance; semantic support is a separate review judgment. */
export function assertFibWordReviewEvidence(
  candidate: FibWordEditorialCandidate,
  review: FibWordReview,
): void {
  const { evidenceIndex, evidenceQuote } = review;
  if (evidenceIndex === null && evidenceQuote === null && review.decision === 'rejected') return;
  const evidence = evidenceIndex === null ? undefined : candidate.evidence[evidenceIndex];
  if (
    evidence === undefined ||
    evidenceQuote === null ||
    !evidence.content.includes(evidenceQuote) ||
    !containsFibWord(evidence.content, candidate.word)
  ) {
    throw new Error(`Fib word review has an invalid evidence citation: ${candidate.word}`);
  }
}

export function parseFibWordReviews(
  value: unknown,
  candidates: readonly FibWordEditorialCandidate[],
): readonly FibWordReview[] {
  if (candidates.length > FIB_WORD_REVIEW_BATCH_LIMIT) {
    throw new Error(`Fib word review exceeds batch limit: ${candidates.length}`);
  }
  const payload = fibWordReviewsPayloadSchema.parse(value);
  if (payload.reviews.length !== candidates.length) {
    throw new Error('Fib word review batch size mismatch');
  }
  assertDistinctCandidates(payload.reviews);
  return payload.reviews.map((review, index) => {
    const candidate = candidates[index];
    if (candidate === undefined || review.word !== candidate.word) {
      throw new Error(`Fib word review did not preserve candidate order at index ${index}`);
    }
    const result: FibWordReview = {
      ...review,
      decision: Object.values(review.qualityChecks).every(Boolean) ? 'accepted' : 'rejected',
    };
    const evidence =
      review.evidenceIndex === null ? undefined : candidate.evidence[review.evidenceIndex];
    const evidenceQuote =
      evidence === undefined || review.evidenceQuote === null
        ? null
        : resolveFibWordEvidenceQuote(evidence.content, review.evidenceQuote);
    if (review.evidenceQuote !== null && evidenceQuote === null) {
      throw new Error(`Fib word review has an invalid evidence citation: ${candidate.word}`);
    }
    const resolvedReview = { ...result, evidenceQuote };
    assertFibWordReviewEvidence(candidate, resolvedReview);
    return resolvedReview;
  });
}
