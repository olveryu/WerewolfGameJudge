/** Gemini structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import { FIB_WORD_JSON_SCHEMA, parseGeneratedFibWordCandidateJson } from './candidate';
import { createFibWordMessages } from './prompt';
import { createFibWordProviderRequestError, FibWordProviderError } from './providerError';
import type { FibWordProvider } from './types';

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

const geminiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
});

export function createGeminiFibWordProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FibWordProvider {
  if (apiKey.length === 0) throw new Error('Gemini Fib word provider requires an API key');

  return {
    async generate(request) {
      let response: Response;
      try {
        response = await fetchImpl(`${GEMINI_OPENAI_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GEMINI_MODEL,
            messages: [...createFibWordMessages(request)],
            temperature: 1,
            max_tokens: 256,
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'fib_word_candidate',
                strict: true,
                schema: FIB_WORD_JSON_SCHEMA,
              },
            },
          }),
          signal: request.signal,
        });
      } catch (error) {
        throw createFibWordProviderRequestError('Gemini', request.signal, error);
      }
      if (!response.ok) {
        const body = await response.text();
        const failureKind =
          response.status === 429
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
        return parseGeneratedFibWordCandidateJson(
          parsed.choices[0].message.content,
          'gemini',
          request,
        );
      } catch (error) {
        if (request.signal.aborted) {
          throw createFibWordProviderRequestError('Gemini', request.signal, error);
        }
        throw new FibWordProviderError('Gemini Fib word response was invalid', 'invalidOutput', {
          cause: error,
        });
      }
    },
  };
}
