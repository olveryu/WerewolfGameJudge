/** FibKing-owned word generation port and provider result contract. */

import type {
  FibWordDefinition,
  FibWordSource,
} from '@game-judge/game-engine/games/fibking/public';

export const FIB_WORD_CATEGORIES = ['literary', 'internet', 'compound', 'niche'] as const;
export const FIB_GENERATED_WORD_CANDIDATE_COUNT = 3;
export const FIB_GENERATED_WORD_RESPONSE_MAX_TOKENS = 512;

export type FibWordCategory = (typeof FIB_WORD_CATEGORIES)[number];

export interface FibWordRequest {
  readonly avoidWords: readonly string[];
  readonly recentWords: readonly string[];
  readonly selectionSeed: string;
  readonly category: FibWordCategory;
  readonly generationDeadlineAt: number;
  readonly signal: AbortSignal;
}

export interface FibWordCandidate {
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly source: FibWordSource;
}

export interface FibWordProvider {
  generate(request: FibWordRequest): Promise<FibWordCandidate>;
}
