/** Workers AI structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import { FIB_WORD_BATCH_JSON_SCHEMA, parseFibWordCandidateBatch } from './candidate';
import { createFibWordMessages } from './prompt';
import type { FibWordProvider } from './types';

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const workersAiResponseSchema = z.object({ response: z.unknown() });

export type FibWorkersAiRun = (model: string, input: Record<string, unknown>) => Promise<unknown>;

export function createWorkersAiFibWordProvider(run: FibWorkersAiRun): FibWordProvider {
  return {
    async generate(request) {
      const response = workersAiResponseSchema.parse(
        await run(WORKERS_AI_MODEL, {
          messages: [...createFibWordMessages(request)],
          temperature: 1,
          max_tokens: 768,
          response_format: {
            type: 'json_schema',
            json_schema: FIB_WORD_BATCH_JSON_SCHEMA,
          },
        }),
      );
      return parseFibWordCandidateBatch(response.response, 'workers-ai', request);
    },
  };
}
