/** Environment-owned Fib word provider selection policy. */

import type { Env } from '../../../env';
import { createGeminiFibWordProvider } from './gemini';
import type { FibWordProvider } from './types';

export type { FibWordCandidate, FibWordProvider, FibWordRequest } from './types';

export function createConfiguredFibWordProvider(bindings: Env): FibWordProvider {
  return createGeminiFibWordProvider(bindings.GEMINI_API_KEY);
}
