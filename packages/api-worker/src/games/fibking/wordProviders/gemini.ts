/** Gemini structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_REVIEWS_JSON_SCHEMA,
  parseFibWordReviews,
  parseGeneratedFibWordCandidates,
} from './candidate';
import { createFibWordMessages, createFibWordReviewMessages } from './prompt';
import {
  createFibWordProviderRequestError,
  FibWordProviderError,
  redactProviderError,
} from './providerError';
import {
  createFibWordEvidenceQuotes,
  resolveFibWordCandidateReferences,
  resolveFibWordReviewReferences,
} from './quoteReferences';
import { FIB_WORD_REVIEW_BATCH_LIMIT, type FibWordProvider, type FibWordRequest } from './types';

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_FIB_WORD_MODEL = 'gemini-3.5-flash-lite';

const geminiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
});

interface GeminiStructuredOutputInput<Output> {
  readonly apiKey: string;
  readonly fetchImpl: typeof fetch;
  readonly request: FibWordRequest;
  readonly messages: readonly { readonly role: string; readonly content: string }[];
  readonly schemaName: string;
  readonly schema: unknown;
  readonly parseOutput: (value: unknown) => Output;
}

async function requestGeminiStructuredOutput<Output>(
  input: GeminiStructuredOutputInput<Output>,
): Promise<Output> {
  let response: Response;
  try {
    response = await input.fetchImpl.call(globalThis, `${GEMINI_OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
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
      }),
      signal: input.request.signal,
    });
  } catch (error) {
    throw createFibWordProviderRequestError('Gemini', input.request.signal, error, input.apiKey);
  }
  if (!response.ok) {
    const body = await response.text();
    const failureKind =
      response.status === 401 || response.status === 403
        ? 'authenticationFailed'
        : response.status === 429
          ? 'rateLimited'
          : response.status >= 500
            ? 'serviceUnavailable'
            : 'requestFailed';
    throw new FibWordProviderError(
      `Gemini Fib word request failed (${response.status}): ${redactProviderError(body, input.apiKey)}`,
      failureKind,
    );
  }
  let failureStage = 'responseJson';
  try {
    const value: unknown = await response.json();
    failureStage = 'responseEnvelope';
    const parsed = geminiResponseSchema.parse(value);
    const firstChoice = parsed.choices[0];
    if (firstChoice === undefined) {
      throw new Error('[FAIL-FAST] Gemini structured response choice was unavailable');
    }
    failureStage = 'contentJson';
    const content: unknown = JSON.parse(firstChoice.message.content);
    failureStage = 'outputValidation';
    return input.parseOutput(content);
  } catch (error) {
    if (input.request.signal.aborted) {
      throw createFibWordProviderRequestError('Gemini', input.request.signal, error, input.apiKey);
    }
    const detail =
      error instanceof Error ? redactProviderError(error.message, input.apiKey) : 'Unknown error';
    throw new FibWordProviderError(
      `Gemini Fib word response was invalid (${failureStage}): ${detail}`,
      'invalidOutput',
      { cause: error },
    );
  }
}

export function createGeminiFibWordProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FibWordProvider {
  if (apiKey.length === 0) throw new Error('Gemini Fib word provider requires an API key');

  return {
    generateBatch(request) {
      const quoteOptions = createFibWordEvidenceQuotes(request.evidence);
      if (quoteOptions.length === 0) return Promise.resolve([]);
      const candidateSchema = FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates.items;
      return requestGeminiStructuredOutput({
        apiKey,
        fetchImpl,
        request,
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
        parseOutput: (value) =>
          parseGeneratedFibWordCandidates(
            resolveFibWordCandidateReferences(value, quoteOptions),
            'gemini',
            request,
          ),
      });
    },
    reviewBatch(request, candidates) {
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
