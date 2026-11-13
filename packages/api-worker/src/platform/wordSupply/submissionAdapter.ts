/** Game-owned external editorial ports; neither ingestion nor review may publish material. */
import type {
  GameWordGame,
  WordSubmissionReview,
} from '@game-judge/game-engine/product/wordSupply';
import type { ZodType } from 'zod';

import type { Env } from '../../env';
import type { AiCorrelation } from '../ai/aiError';

export interface SubmissionMaterial {
  readonly identity: string;
  readonly title: string;
  readonly category: string;
  readonly content: Record<string, unknown>;
}

export interface SubmissionReviewResult {
  readonly review: WordSubmissionReview;
  readonly verifiedContent: Record<string, unknown>;
}

/** SQL gates originate in trusted code, never request content. */
export interface SubmissionPublication {
  readonly itemId: string;
  readonly identity: string;
  readonly content: Record<string, unknown>;
  readonly verifiedContent: Record<string, unknown>;
  readonly review: WordSubmissionReview;
  readonly actionId: string;
  readonly now: string;
}

export interface WordSubmissionAdapter {
  readonly game: GameWordGame;
  readonly inputSchema: ZodType;
  readonly model: string;
  readonly reviewVersion: string;
  readonly reviewBatchLimit: number;
  readonly normalize: (value: unknown) => Promise<SubmissionMaterial>;
  readonly inventoryExistsSql: string;
  readonly prepareReview?: (
    env: Env,
    content: Record<string, unknown>,
    claimEvidenceRequest: (operation: string) => Promise<void>,
  ) => Promise<Record<string, unknown>>;
  readonly review: (
    env: Env,
    contents: readonly Record<string, unknown>[],
    context: AiCorrelation,
  ) => Promise<readonly SubmissionReviewResult[]>;
  readonly publish: (
    db: D1Database,
    publication: SubmissionPublication,
  ) => readonly D1PreparedStatement[];
  readonly unpublish: (
    db: D1Database,
    publication: SubmissionPublication,
  ) => readonly D1PreparedStatement[];
}

/** A publication receipt gates every game-owned mutation within the same D1 batch. */
export const SUBMISSION_PUBLICATION_GATE = `EXISTS (
  SELECT 1 FROM word_submission_items item JOIN word_submission_actions action
    ON action.id = item.publication_action_id
  WHERE item.id = ? AND action.id = ? AND action.status = 'applying'
)`;
