/** Deterministic local Fib word provider. */

import { selectLocalFibWordCandidate } from './candidate';
import { LOCAL_FIB_WORD_BANK } from './localWordBank';
import type { FibWordProvider } from './types';

export function createLocalFibWordProvider(): FibWordProvider {
  return {
    async generate(request) {
      return selectLocalFibWordCandidate(LOCAL_FIB_WORD_BANK, request);
    },
  };
}
