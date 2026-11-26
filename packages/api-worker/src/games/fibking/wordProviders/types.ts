/** FibKing-owned word generation port and provider result contract. */

import type {
  FibWordCategory,
  FibWordDefinition,
  FibWordSource,
} from '@game-judge/game-engine/games/fibking/public';

import type { AiCorrelation } from '../../../platform/ai/aiError';
import type { GeneratedCandidateBatch } from '../../../platform/wordSupply/generatedCandidates';
import type { FibWordEvidence } from './tavily';

export const FIB_WORD_GENERATION_BATCH_LIMIT = 1;
export const FIB_WORD_REVIEW_BATCH_LIMIT = 1;
// Durable checkpoints and completed packs retain their original batch boundaries.
export const FIB_WORD_STORED_GENERATION_BATCH_LIMIT = 12;
export const FIB_WORD_STORED_REVIEW_BATCH_LIMIT = 6;
export type FibWordReviewDecision = 'accepted' | 'rejected';

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

/** Category evidence stays server-side and never changes the selected-word contract. */
export interface FibWordEditorialCandidate extends FibWordCandidate {
  readonly category: FibWordCategory;
  readonly evidence: readonly FibWordEvidence[];
}

export interface FibWordQualityChecks {
  readonly isEstablishedTerm: boolean;
  readonly isDefinitionAccurate: boolean;
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
  generateBatch(
    request: FibWordRequest,
    context?: AiCorrelation,
  ): Promise<GeneratedCandidateBatch<FibWordEditorialCandidate>>;

  /** Review a generated batch in an independent model request. */
  reviewBatch(
    request: FibWordRequest,
    candidates: readonly FibWordEditorialCandidate[],
    context?: AiCorrelation,
  ): Promise<readonly FibWordReview[]>;
}
