/** Gemini structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import {
  type AiCorrelation,
  AiProviderError,
  parseAiOutput,
  readAiJson,
  reportAiFailure,
} from '../../../platform/ai/aiError';
import { requestGemini } from '../../../platform/ai/geminiRequest';
import { parseGeneratedCandidateBatch } from '../../../platform/wordSupply/generatedCandidates';
import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_REVIEWS_JSON_SCHEMA,
  parseFibWordReviews,
  parseGeneratedFibWordCandidate,
} from './candidate';
import { createFibWordMessages, createFibWordReviewMessages } from './prompt';
import {
  createFibWordEvidenceQuotes,
  resolveFibWordCandidateReference,
  resolveFibWordReviewReferences,
} from './quoteReferences';
import {
  FIB_WORD_GENERATION_BATCH_LIMIT,
  FIB_WORD_REVIEW_BATCH_LIMIT,
  type FibWordProvider,
  type FibWordRequest,
} from './types';

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_FIB_WORD_MODEL = 'gemini-3.5-flash-lite';

const geminiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.literal('stop'),
        message: z.object({ content: z.string() }),
      }),
    )
    .length(1),
});

interface GeminiStructuredOutputInput<Output> {
  readonly apiKey: string;
  readonly fetchImpl: typeof fetch;
  readonly request: FibWordRequest;
  readonly messages: readonly { readonly role: string; readonly content: string }[];
  readonly schemaName: string;
  readonly schema: unknown;
  readonly parseOutput: (value: unknown) => Output;
  readonly operation: 'generate' | 'review';
  readonly context: AiCorrelation;
}

async function requestGeminiStructuredOutput<Output>(
  input: GeminiStructuredOutputInput<Output>,
): Promise<Output> {
  const context = {
    ...input.context,
    game: 'fibking',
    model: GEMINI_FIB_WORD_MODEL,
    operation: input.operation,
  };
  const privateValues = [input.apiKey, input.messages, input.request.evidence];
  const body = JSON.stringify({
    model: GEMINI_FIB_WORD_MODEL,
    messages: [...input.messages],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
  });
  return requestGemini({
    context,
    protocol: 'openaiCompatible',
    requestBytes: new TextEncoder().encode(body).byteLength,
    apiKey: input.apiKey,
    signal: input.request.signal,
    privateValues,
    request: () =>
      input.fetchImpl.call(globalThis, `${GEMINI_OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
        },
        body,
        signal: input.request.signal,
      }),
    parseResponse: async (response) => {
      const value = await readAiJson(context, response, input.request.signal, privateValues);
      const firstChoice = parseAiOutput(
        context,
        'responseEnvelope',
        () => geminiResponseSchema.parse(value).choices[0],
      );
      if (firstChoice === undefined) {
        throw new Error('[FAIL-FAST] Gemini structured response choice was unavailable');
      }
      const content = parseAiOutput(context, 'contentJson', (): unknown =>
        JSON.parse(firstChoice.message.content),
      );
      return parseAiOutput(context, 'outputValidation', () => input.parseOutput(content));
    },
  });
}

/** Independent Gemini generation and review requests, with no automatic retries. */
export function createGeminiFibWordProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FibWordProvider {
  if (apiKey.length === 0) {
    const error = new AiProviderError(
      { game: 'fibking', model: GEMINI_FIB_WORD_MODEL },
      'request',
      'configuration',
    );
    reportAiFailure(error);
    throw error;
  }
  return {
    generateBatch(request, context = {}) {
      const quoteOptions = createFibWordEvidenceQuotes(request.evidence);
      const decode = (value: unknown) =>
        parseGeneratedCandidateBatch(value, {
          limit: FIB_WORD_GENERATION_BATCH_LIMIT,
          context: {
            ...context,
            game: 'fibking',
            model: GEMINI_FIB_WORD_MODEL,
            operation: 'generate',
          },
          parseCandidate: (candidate) =>
            parseGeneratedFibWordCandidate(
              resolveFibWordCandidateReference(candidate, quoteOptions),
              'gemini',
              request,
            ),
          getIdentity: ({ word }) => word,
        });
      if (quoteOptions.length === 0) return Promise.resolve(decode({ candidates: [] }));
      const candidateSchema = FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates.items;
      return requestGeminiStructuredOutput({
        apiKey,
        fetchImpl,
        request,
        context,
        operation: 'generate',
        messages: createFibWordMessages(request, quoteOptions),
        schemaName: 'fib_word_candidates',
        schema: {
          ...FIB_WORD_CANDIDATES_JSON_SCHEMA,
          properties: {
            candidates: {
              ...FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates,
              items: {
                ...candidateSchema,
                properties: {
                  ...candidateSchema.properties,
                  citations: {
                    ...candidateSchema.properties.citations,
                    items: {
                      ...candidateSchema.properties.citations.items,
                      properties: {
                        ...candidateSchema.properties.citations.items.properties,
                        quote: { type: 'string', enum: quoteOptions.map(({ id }) => id) },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        parseOutput: decode,
      });
    },
    reviewBatch(request, candidates, context = {}) {
      if (candidates.length === 0) return Promise.resolve([]);
      if (candidates.length > FIB_WORD_REVIEW_BATCH_LIMIT) {
        throw new Error(`Fib word review exceeds batch limit: ${candidates.length}`);
      }
      const quoteOptions = candidates.map((candidate) =>
        createFibWordEvidenceQuotes(candidate.evidence),
      );
      const quoteIds = [...new Set(quoteOptions.flatMap((options) => options.map(({ id }) => id)))];
      return requestGeminiStructuredOutput({
        apiKey,
        fetchImpl,
        request,
        context,
        operation: 'review',
        messages: createFibWordReviewMessages(request, candidates, quoteOptions),
        schemaName: 'fib_word_reviews',
        schema: {
          ...FIB_WORD_REVIEWS_JSON_SCHEMA,
          properties: {
            reviews: {
              ...FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews,
              minItems: candidates.length,
              maxItems: candidates.length,
              items: {
                ...FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews.items,
                properties: {
                  ...FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews.items.properties,
                  word: {
                    type: 'string',
                    enum: candidates.map(({ word }) => word),
                  },
                  evidenceQuote:
                    quoteIds.length === 0
                      ? { type: 'null' }
                      : {
                          anyOf: [{ type: 'string', enum: quoteIds }, { type: 'null' }],
                        },
                },
              },
            },
          },
        },
        parseOutput: (value) =>
          parseFibWordReviews(
            resolveFibWordReviewReferences(value, candidates, quoteOptions),
            candidates,
          ),
      });
    },
  };
}
