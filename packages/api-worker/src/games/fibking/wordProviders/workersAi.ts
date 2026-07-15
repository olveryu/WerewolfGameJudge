/** Workers AI structured-output adapter for the Fib word provider port. */

import { FIB_WORD_JSON_SCHEMA, parseFibWordCandidate } from './candidate';
import { createFibWordMessages } from './prompt';
import type { FibWordProvider } from './types';

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

export function createWorkersAiFibWordProvider(ai: Ai): FibWordProvider {
  return {
    async generate(request) {
      const response = await ai.run(WORKERS_AI_MODEL, {
        messages: [...createFibWordMessages(request)],
        temperature: 1,
        max_tokens: 256,
        response_format: {
          type: 'json_schema',
          json_schema: FIB_WORD_JSON_SCHEMA,
        },
      });
      if (typeof response === 'string' || !('response' in response)) {
        throw new Error('Workers AI Fib word response is not synchronous text output');
      }
      return parseFibWordCandidate(response.response, 'workers-ai', request.avoidWords);
    },
  };
}
