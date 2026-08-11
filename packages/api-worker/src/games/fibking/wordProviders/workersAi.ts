/** Workers AI structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import { FIB_WORD_CANDIDATES_JSON_SCHEMA, selectGeneratedFibWordCandidate } from './candidate';
import { createFibWordMessages } from './prompt';
import { createFibWordProviderRequestError, FibWordProviderError } from './providerError';
import { FIB_GENERATED_WORD_RESPONSE_MAX_TOKENS, type FibWordProvider } from './types';

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const workersAiResponseSchema = z.object({ response: z.unknown() });

export type FibWorkersAiRun = (
  model: string,
  input: Record<string, unknown>,
  options: { readonly signal: AbortSignal },
) => Promise<unknown>;

export function createWorkersAiFibWordProvider(run: FibWorkersAiRun): FibWordProvider {
  return {
    async generate(request) {
      let rawResponse: unknown;
      try {
        rawResponse = await run(
          WORKERS_AI_MODEL,
          {
            messages: [...createFibWordMessages(request)],
            temperature: 1,
            max_tokens: FIB_GENERATED_WORD_RESPONSE_MAX_TOKENS,
            response_format: {
              type: 'json_schema',
              json_schema: FIB_WORD_CANDIDATES_JSON_SCHEMA,
            },
          },
          { signal: request.signal },
        );
      } catch (error) {
        throw createFibWordProviderRequestError('Workers AI', request.signal, error);
      }
      try {
        const response = workersAiResponseSchema.parse(rawResponse);
        return selectGeneratedFibWordCandidate(response.response, 'workers-ai', request);
      } catch (error) {
        throw new FibWordProviderError(
          'Workers AI Fib word response was invalid',
          'invalidOutput',
          {
            cause: error,
          },
        );
      }
    },
  };
}
