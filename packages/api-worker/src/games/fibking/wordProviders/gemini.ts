/** Gemini structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import { FIB_WORD_JSON_SCHEMA, parseFibWordCandidateJson } from './candidate';
import { createFibWordMessages } from './prompt';
import type { FibWordProvider } from './types';

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_TIMEOUT_MS = 15_000;

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
      const response = await fetchImpl(`${GEMINI_OPENAI_BASE}/chat/completions`, {
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
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gemini Fib word request failed (${response.status}): ${body.slice(0, 500)}`,
        );
      }
      const parsed = geminiResponseSchema.parse(await response.json());
      return parseFibWordCandidateJson(
        parsed.choices[0].message.content,
        'gemini',
        request.avoidWords,
      );
    },
  };
}
