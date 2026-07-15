/** Environment-owned Fib word provider selection policy. */

import { isFibWordSource } from '@game-judge/game-engine/games/fibking/public';

import type { Env } from '../../../env';
import { createGeminiFibWordProvider } from './gemini';
import { createLocalFibWordProvider } from './local';
import type { FibWordProvider } from './types';
import { createWorkersAiFibWordProvider } from './workersAi';

export type { FibWordCandidate, FibWordProvider, FibWordRequest } from './types';

export function createConfiguredFibWordProvider(bindings: Env): FibWordProvider {
  const configuredSource = bindings.FIB_WORD_PROVIDER;
  if (!isFibWordSource(configuredSource)) {
    throw new Error(`Unknown FIB_WORD_PROVIDER: ${configuredSource}`);
  }

  switch (configuredSource) {
    case 'gemini':
      if (bindings.GEMINI_API_KEY === undefined) {
        throw new Error('FIB_WORD_PROVIDER=gemini requires GEMINI_API_KEY');
      }
      return createGeminiFibWordProvider(bindings.GEMINI_API_KEY);
    case 'workers-ai':
      return createWorkersAiFibWordProvider(bindings.AI);
    case 'local':
      return createLocalFibWordProvider();
  }
  const exhaustive: never = configuredSource;
  return exhaustive;
}
