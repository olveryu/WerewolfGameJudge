/** Deterministic local Fib word provider. */

import { parseFibWordCandidate } from './candidate';
import { LOCAL_FIB_WORD_BANK } from './localWordBank';
import type { FibWordProvider } from './types';

export function createLocalFibWordProvider(): FibWordProvider {
  return {
    async generate(request) {
      const candidate = LOCAL_FIB_WORD_BANK.find(
        (entry) => !request.avoidWords.includes(entry.word),
      );
      if (candidate === undefined) {
        throw new Error('Local Fib word bank has no candidate outside the used-word window');
      }
      return parseFibWordCandidate(candidate, 'local', request.avoidWords);
    },
  };
}
