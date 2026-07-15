/** FibKing-owned word generation port and provider result contract. */

import type { FibWordSource } from '@game-judge/game-engine/games/fibking/public';

export interface FibWordRequest {
  readonly avoidWords: readonly string[];
}

export interface FibWordCandidate {
  readonly word: string;
  readonly definition: string;
  readonly source: FibWordSource;
}

export interface FibWordProvider {
  generate(request: FibWordRequest): Promise<FibWordCandidate>;
}
