/** FibKing-owned word generation port and provider result contract. */

import type { FibWordSource } from '@game-judge/game-engine/games/fibking/public';

export const FIB_WORD_CANDIDATE_COUNT = 4;
export const FIB_WORD_CATEGORIES = ['literary', 'internet', 'compound', 'niche'] as const;

export type FibWordCategory = (typeof FIB_WORD_CATEGORIES)[number];

export interface FibWordRequest {
  readonly avoidWords: readonly string[];
  readonly recentWords: readonly string[];
  readonly selectionSeed: string;
}

export interface FibWordCandidate {
  readonly word: string;
  readonly definition: string;
  readonly source: FibWordSource;
}

export interface FibWordProvider {
  generate(request: FibWordRequest): Promise<FibWordCandidate>;
}
