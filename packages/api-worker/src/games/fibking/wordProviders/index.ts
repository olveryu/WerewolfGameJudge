/** Environment-owned Fib word provider selection policy. */

import type { Env } from '../../../env';
import { createGeminiFibWordProvider } from './gemini';
import { createLocalFibWordProvider } from './local';
import type { FibWordProvider } from './types';

export type { FibWordCandidate, FibWordProvider, FibWordRequest } from './types';

export function createConfiguredFibWordProvider(bindings: Env): FibWordProvider {
  const configuredSource = bindings.FIB_WORD_PROVIDER;
  if (configuredSource === 'local') {
    return createLocalFibWordProvider();
  }
  if (configuredSource !== 'gemini') {
    throw new Error(`Unknown FIB_WORD_PROVIDER: ${configuredSource}`);
  }
  return createGeminiFibWordProvider(bindings.GEMINI_API_KEY);
}
