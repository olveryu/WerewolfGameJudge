/** FibKing-owned word generation port and provider result contract. */

import type {
  FibWordDefinition,
  FibWordSource,
} from '@game-judge/game-engine/games/fibking/public';

export const FIB_WORD_CATEGORIES = ['literary', 'internet', 'compound', 'niche'] as const;
export const FIB_GENERATED_WORD_CANDIDATE_COUNT = 6;
export const FIB_WORD_REVIEW_DECISIONS = ['accepted', 'rejected'] as const;

export type FibWordCategory = (typeof FIB_WORD_CATEGORIES)[number];
export type FibWordReviewDecision = (typeof FIB_WORD_REVIEW_DECISIONS)[number];

export interface FibWordRequest {
  readonly category: FibWordCategory;
  readonly deadlineAt: number;
  readonly signal: AbortSignal;
}

export interface FibWordCandidate {
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly source: FibWordSource;
}

export interface FibWordReview {
  readonly word: string;
  readonly decision: FibWordReviewDecision;
  readonly reason: string;
}

export interface FibWordProvider {
  /** Generate candidate questions without deciding which candidates enter the active pool. */
  generateBatch(request: FibWordRequest): Promise<readonly FibWordCandidate[]>;

  /** Review a generated batch in an independent model request. */
  reviewBatch(
    request: FibWordRequest,
    candidates: readonly FibWordCandidate[],
  ): Promise<readonly FibWordReview[]>;
}
