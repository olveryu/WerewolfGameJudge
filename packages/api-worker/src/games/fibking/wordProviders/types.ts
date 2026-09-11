/** FibKing-owned word generation port and provider result contract. */

import type {
  FibWordDefinition,
  FibWordSource,
} from '@game-judge/game-engine/games/fibking/public';

import type { FibWordEvidence } from './tavily';

export const FIB_WORD_CATEGORIES = ['literary', 'internet', 'compound', 'niche'] as const;
export const FIB_WORD_GENERATION_BATCH_LIMIT = 12;
export const FIB_WORD_REVIEW_BATCH_LIMIT = 6;
export const FIB_WORD_REVIEW_DECISIONS = ['accepted', 'rejected'] as const;

export type FibWordCategory = (typeof FIB_WORD_CATEGORIES)[number];
export type FibWordReviewDecision = (typeof FIB_WORD_REVIEW_DECISIONS)[number];

export interface FibWordRequest {
  readonly category: FibWordCategory;
  readonly deadlineAt: number;
  readonly signal: AbortSignal;
  readonly evidence: readonly FibWordEvidence[];
}

export interface FibWordCandidate {
  readonly word: string;
  readonly definition: FibWordDefinition;
  readonly source: FibWordSource;
}

/** Editorial provenance stays server-side and never changes the selected-word contract. */
export interface FibWordEditorialCandidate extends FibWordCandidate {
  readonly category: FibWordCategory;
  readonly evidence: readonly FibWordEvidence[];
}

export interface FibWordQualityChecks {
  readonly isEstablishedTerm: boolean;
  readonly isDefinitionAccurate: boolean;
  readonly isEasyToReadAloud: boolean;
  readonly isMeaningUnfamiliarToMostPlayers: boolean;
  readonly isMeaningDistinctFromLiteralReading: boolean;
  readonly hasMultiplePlausibleWrongDefinitions: boolean;
  readonly hasRevealValue: boolean;
}

export interface FibWordReview {
  readonly word: string;
  readonly qualityChecks: FibWordQualityChecks;
  readonly decision: FibWordReviewDecision;
  readonly reason: string;
  readonly evidenceIndex: number | null;
  readonly evidenceQuote: string | null;
}

export interface FibWordProvider {
  /** Extract source-backed candidates without deciding which enter the active inventory. */
  generateBatch(request: FibWordRequest): Promise<readonly FibWordEditorialCandidate[]>;

  /** Review a generated batch in an independent model request. */
  reviewBatch(
    request: FibWordRequest,
    candidates: readonly FibWordEditorialCandidate[],
  ): Promise<readonly FibWordReview[]>;
}
