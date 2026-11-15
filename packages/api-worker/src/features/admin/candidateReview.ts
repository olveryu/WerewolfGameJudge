/**
 * Manual candidate review and publish: the single road from approval to the
 * inventory. A human selects approved candidates, starts an independent
 * model review (the same reviewBatch + independent-review prompt the
 * submission review uses), then confirms publication. The supply workflow
 * never reviews or publishes — there is no other road.
 *
 * Batch (2026-11-15 user ruling): review takes up to 5 candidates per call,
 * grouped by category and reviewed one model call per candidate (all three
 * games review one at a time); the page chunks larger selections into
 * groups of 5. Publish takes up to 30 passed candidates in one atomic
 * transaction. Single-row buttons and the bulk bar call the same endpoints.
 * A passed candidate may be re-reviewed (like a passed submission): its
 * stored review can go stale when the review version changes.
 *
 * The per-game review and publish live in the games' candidate-review
 * adapters, composed in the Worker game catalog; this file only locks,
 * groups, and aggregates, so it never imports a concrete game.
 */
import type {
  GameWordGame,
  PublishWordCandidatesResult,
  ReviewWordCandidatesResult,
} from '@game-judge/game-engine/product/wordSupply';
import { z } from 'zod';

import type { Env } from '../../env';
import { WORKER_WORD_CANDIDATE_REVIEW_ADAPTERS } from '../../games/catalog';
import { createLogger } from '../../platform/observability/logger';
import { gameWordGameSchema } from './gameWords';

const log = createLogger('word-candidate-review');

/** One manual review call reviews at most five candidates (one model call
 * each — all three games review one at a time). */
export const CANDIDATE_MANUAL_REVIEW_LIMIT = 5;
/** One manual publish call publishes at most thirty candidates (pure D1,
 * same cap as approve/dismiss). */
export const CANDIDATE_MANUAL_PUBLISH_LIMIT = 30;

export const reviewWordCandidatesSchema = z.strictObject({
  game: gameWordGameSchema,
  candidateIds: z.array(z.string().min(1)).min(1).max(CANDIDATE_MANUAL_REVIEW_LIMIT),
});
export type ReviewWordCandidatesInput = z.output<typeof reviewWordCandidatesSchema>;

export const publishWordCandidatesSchema = z.strictObject({
  game: gameWordGameSchema,
  candidateIds: z.array(z.string().min(1)).min(1).max(CANDIDATE_MANUAL_PUBLISH_LIMIT),
});
export type PublishWordCandidatesInput = z.output<typeof publishWordCandidatesSchema>;

/** Statuses a manual review may start from: approved, failed (retry), and
 * passed (re-review, e.g. after a review-version change). */
const REVIEWABLE_STATUSES = "('approved', 'failed', 'passed')";

const CANDIDATE_TABLES = {
  fibking: 'fib_word_candidates',
  undercover: 'undercover_word_candidates',
  drawguess: 'drawguess_word_candidates',
} as const;

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

interface LoadedCandidate {
  readonly id: string;
  readonly category: string;
}

/** Load the requested candidates that are in a reviewable state, oldest first. */
async function loadReviewableCandidates(
  db: D1Database,
  game: GameWordGame,
  candidateIds: readonly string[],
): Promise<{ readonly candidates: LoadedCandidate[]; readonly skippedIds: string[] }> {
  const table = CANDIDATE_TABLES[game];
  const rows = await db
    .prepare(
      `SELECT id, category FROM ${table}
       WHERE id IN (${placeholders(candidateIds.length)}) AND status IN ${REVIEWABLE_STATUSES}
       ORDER BY created_at, id`,
    )
    .bind(...candidateIds)
    .all();
  const candidates = z
    .array(z.strictObject({ id: z.string(), category: z.string() }))
    .parse(rows.results);
  const found = new Set(candidates.map((candidate) => candidate.id));
  return {
    candidates,
    skippedIds: candidateIds.filter((id) => !found.has(id)),
  };
}

/** Atomically move the loaded candidates into 'reviewing'; the returned ids
 * are the ones this call owns (a concurrent review of the same rows loses). */
async function markReviewing(
  db: D1Database,
  game: GameWordGame,
  candidateIds: readonly string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const table = CANDIDATE_TABLES[game];
  const result = await db
    .prepare(
      `UPDATE ${table} SET status = 'reviewing'
       WHERE id IN (${placeholders(candidateIds.length)}) AND status IN ${REVIEWABLE_STATUSES}
       RETURNING id`,
    )
    .bind(...candidateIds)
    .all();
  return z
    .array(z.strictObject({ id: z.string() }))
    .parse(result.results)
    .map((row) => row.id);
}

async function markReviewFailed(
  db: D1Database,
  game: GameWordGame,
  candidateId: string,
): Promise<void> {
  const table = CANDIDATE_TABLES[game];
  await db
    .prepare(`UPDATE ${table} SET status = 'failed' WHERE id = ? AND status = 'reviewing'`)
    .bind(candidateId)
    .run();
}

/** Start an independent model review for the selected approved candidates,
 * grouped by category and reviewed one model call per candidate. A
 * candidate whose review errors returns to 'failed' and can be retried;
 * the other candidates still complete. */
export async function reviewWordCandidates(
  db: D1Database,
  env: Env,
  input: ReviewWordCandidatesInput,
): Promise<ReviewWordCandidatesResult> {
  const adapter = WORKER_WORD_CANDIDATE_REVIEW_ADAPTERS[input.game];
  const { candidates, skippedIds: unknownIds } = await loadReviewableCandidates(
    db,
    input.game,
    input.candidateIds,
  );
  const lockedIds = await markReviewing(
    db,
    input.game,
    candidates.map((candidate) => candidate.id),
  );
  const locked = new Set(lockedIds);
  const skippedIds = [
    ...unknownIds,
    ...candidates.filter((candidate) => !locked.has(candidate.id)).map((candidate) => candidate.id),
  ];
  const passedIds: string[] = [];
  const rejectedIds: string[] = [];
  const failedIds: string[] = [];

  // Group by category (first-seen order); within a category, review oldest
  // first, one model call per candidate.
  const byCategory = new Map<string, LoadedCandidate[]>();
  for (const candidate of candidates) {
    if (!locked.has(candidate.id)) continue;
    const group = byCategory.get(candidate.category) ?? [];
    group.push(candidate);
    byCategory.set(candidate.category, group);
  }
  for (const group of byCategory.values()) {
    for (const item of group) {
      try {
        const isAccepted = await adapter.reviewCandidate(db, env, item.id, {
          packId: 'manual-review',
        });
        (isAccepted ? passedIds : rejectedIds).push(item.id);
      } catch (error) {
        log.warn('manual candidate review failed', {
          game: input.game,
          candidateId: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
        try {
          await markReviewFailed(db, input.game, item.id);
        } catch {
          // The candidate stays 'reviewing' when even the failure mark
          // cannot write; the error surfaces through failedIds.
        }
        failedIds.push(item.id);
      }
    }
  }
  return { game: input.game, passedIds, rejectedIds, failedIds, skippedIds };
}

/** Load the requested candidates that are in 'passed' state, oldest first. */
async function loadPassedCandidates(
  db: D1Database,
  game: GameWordGame,
  candidateIds: readonly string[],
): Promise<{ readonly candidates: LoadedCandidate[]; readonly skippedIds: string[] }> {
  const table = CANDIDATE_TABLES[game];
  const rows = await db
    .prepare(
      `SELECT id, category FROM ${table}
       WHERE id IN (${placeholders(candidateIds.length)}) AND status = 'passed'
       ORDER BY created_at, id`,
    )
    .bind(...candidateIds)
    .all();
  const candidates = z
    .array(z.strictObject({ id: z.string(), category: z.string() }))
    .parse(rows.results);
  const found = new Set(candidates.map((candidate) => candidate.id));
  return {
    candidates,
    skippedIds: candidateIds.filter((id) => !found.has(id)),
  };
}

/**
 * Publish the selected passed candidates in one atomic batch, through the
 * game's adapter. The publish gate mirrors the submission publish gate:
 * the stored review must be an acceptance under the current review version,
 * and the word must not already be in the inventory (unless it is
 * disabled, in which case it is reactivated). A candidate that fails the
 * gate stays 'passed' (skipped here, re-reviewable).
 */
export async function publishWordCandidates(
  db: D1Database,
  input: PublishWordCandidatesInput,
): Promise<PublishWordCandidatesResult> {
  const adapter = WORKER_WORD_CANDIDATE_REVIEW_ADAPTERS[input.game];
  const { candidates, skippedIds } = await loadPassedCandidates(db, input.game, input.candidateIds);
  const { publishedIds, rejectedIds } = await adapter.publishCandidates(
    db,
    candidates.map((candidate) => candidate.id),
  );
  return {
    game: input.game,
    publishedIds: [...publishedIds],
    rejectedIds: [...rejectedIds],
    skippedIds,
  };
}
