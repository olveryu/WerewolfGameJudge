/** Gemini structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_REVIEWS_JSON_SCHEMA,
  parseFibWordReviews,
  parseGeneratedFibWordCandidates,
} from './candidate';
import { createFibWordMessages, createFibWordReviewMessages } from './prompt';
import { createFibWordProviderRequestError, FibWordProviderError } from './providerError';
import type { FibWordProvider, FibWordRequest } from './types';

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
    response = await input.fetchImpl(`${GEMINI_OPENAI_BASE}/chat/completions`, {
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
    throw createFibWordProviderRequestError('Gemini', input.request.signal, error);
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
      `Gemini Fib word request failed (${response.status}): ${body.slice(0, 500)}`,
      failureKind,
    );
  }
  try {
    const parsed = geminiResponseSchema.parse(await response.json());
    const firstChoice = parsed.choices[0];
    if (firstChoice === undefined) {
      throw new Error('[FAIL-FAST] Gemini structured response choice was unavailable');
    }
    return input.parseOutput(JSON.parse(firstChoice.message.content));
  } catch (error) {
    if (input.request.signal.aborted) {
      throw createFibWordProviderRequestError('Gemini', input.request.signal, error);
    }
    throw new FibWordProviderError('Gemini Fib word response was invalid', 'invalidOutput', {
      cause: error,
    });
  }
}

export function createGeminiFibWordProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FibWordProvider {
  if (apiKey.length === 0) throw new Error('Gemini Fib word provider requires an API key');

  return {
    generateBatch(request) {
      return requestGeminiStructuredOutput({
        apiKey,
        fetchImpl,
        request,
        messages: createFibWordMessages(request),
        schemaName: 'fib_word_candidates',
        schema: FIB_WORD_CANDIDATES_JSON_SCHEMA,
        parseOutput: (value) => parseGeneratedFibWordCandidates(value, 'gemini', request),
      });
    },
    reviewBatch(request, candidates) {
      return requestGeminiStructuredOutput({
        apiKey,
        fetchImpl,
        request,
        messages: createFibWordReviewMessages(request, candidates),
        schemaName: 'fib_word_reviews',
        schema: FIB_WORD_REVIEWS_JSON_SCHEMA,
        parseOutput: (value) => parseFibWordReviews(value, candidates),
      });
    },
  };
}
