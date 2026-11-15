/**
 * Manual candidate review/publish adapters: one per word game, composed in
 * the Worker game catalog (like the submission adapters). The admin feature
 * only talks to the catalog map, so no shared feature ever imports a
 * concrete game — pinned by `composes multiple concrete Worker games only
 * in the catalog and Workflow entrypoint` in
 * contracts/architecture.contract.test.ts.
 *
 * A candidate review is the same independent review (reviewBatch +
 * independent-review prompt) the submission review uses; a publish is the
 * same gate (a stored acceptance under the current review version) and the
 * same inventory upsert the old supply-pack publish did. The pair games
 * share one review/publish implementation here, parameterized by their
 * per-game providers, parsers, and inventory builders; fibking keeps its
 * own adapter because its evidence and review-row storage differ.
 */
import type { GameWordGame } from '@game-judge/game-engine/product/wordSupply';
import { z } from 'zod';

import type { Env } from '../../env';
import type { AiCorrelation } from '../ai/aiError';
import { claimEditorialModelRequest } from '../ai/editorialBudget';

export interface WordCandidateReviewAdapter {
  readonly game: GameWordGame;
  readonly model: string;
  readonly reviewVersion: string;
  /**
   * Review one locked ('reviewing') candidate and store passed/rejected.
   * Returns true when the model accepts it. Throws when the review itself
   * fails (the caller marks the candidate 'failed' so it can be retried).
   */
  reviewCandidate(
    db: D1Database,
    env: Env,
    candidateId: string,
    context: AiCorrelation,
  ): Promise<boolean>;
  /**
   * Publish passed candidates in one atomic batch. Returns the published
   * ids and the gate-rejected ids (which stay 'passed', re-reviewable).
   */
  publishCandidates(
    db: D1Database,
    candidateIds: readonly string[],
  ): Promise<{
    readonly publishedIds: readonly string[];
    readonly rejectedIds: readonly string[];
  }>;
}

/** The stored accepted review, in the same shape the workflow wrote it (the
 * pack is null here: a manual review belongs to no pack). */
export interface StoredCandidateReview {
  readonly reviewVersion: string;
  readonly promptVersion: string;
  readonly packId: string | null;
  readonly review: unknown;
}

const storedReviewJsonSchema = z.strictObject({
  reviewVersion: z.string(),
  promptVersion: z.string(),
  packId: z.string().nullable(),
  review: z.unknown(),
});

function buildStoredReviewJson(
  reviewVersion: string,
  promptVersion: string,
  review: unknown,
): string {
  return JSON.stringify({ reviewVersion, promptVersion, packId: null, review });
}

/** The stored review for a pair candidate (undercover/drawguess). */
async function loadStoredPairReview(
  db: D1Database,
  table: 'undercover_word_candidates' | 'drawguess_word_candidates',
  candidateId: string,
): Promise<StoredCandidateReview | null> {
  const row = z
    .strictObject({ review_json: z.string().nullable() })
    .parse(
      await db.prepare(`SELECT review_json FROM ${table} WHERE id = ?`).bind(candidateId).first(),
    );
  if (row.review_json === null) return null;
  return storedReviewJsonSchema.parse(JSON.parse(row.review_json));
}

async function storePairReviewOutcome(
  db: D1Database,
  table: 'undercover_word_candidates' | 'drawguess_word_candidates',
  candidateId: string,
  reviewVersion: string,
  promptVersion: string,
  review: unknown,
  isAccepted: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE ${table} SET status = ?, reviewed_at = ?, review_json = ?
       WHERE id = ? AND status = 'reviewing'`,
    )
    .bind(
      isAccepted ? 'passed' : 'rejected',
      now,
      buildStoredReviewJson(reviewVersion, promptVersion, review),
      candidateId,
    )
    .run();
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export interface PairWordReviewProvider<TCandidate, TReview, TCategory> {
  reviewBatch(
    category: TCategory,
    candidates: readonly TCandidate[],
    context: AiCorrelation,
  ): Promise<readonly TReview[]>;
}

/**
 * What a pair game (undercover/drawguess) supplies to the shared candidate
 * review/publish implementation: its provider, its parsers, and the one
 * inventory statement it writes on publish.
 */
export interface PairCandidateDeps<TCandidate, TReview, TCategory> {
  readonly game: 'undercover' | 'drawguess';
  readonly table: 'undercover_word_candidates' | 'drawguess_word_candidates';
  readonly model: string;
  readonly reviewVersion: string;
  readonly promptVersion: string;
  readonly parseCategory: (value: unknown) => TCategory;
  readonly createProvider: (
    apiKey: string,
  ) => PairWordReviewProvider<TCandidate, TReview, TCategory>;
  readonly parseCandidates: (value: unknown, category: TCategory) => readonly TCandidate[];
  readonly parseReviews: (value: unknown, candidates: readonly TCandidate[]) => readonly TReview[];
  readonly isReviewAccepted: (review: TReview) => boolean;
  readonly getCandidateId: (candidate: TCandidate) => Promise<string>;
  readonly buildInventory: (
    db: D1Database,
    candidate: TCandidate,
    stored: StoredCandidateReview,
    now: string,
  ) => Promise<PairInventoryBuild>;
}

/**
 * The inventory write a pair publish makes. `unpublishable` means the model
 * accepted the word but it can never enter the inventory (a drawguess word
 * whose pinyin initials cannot be computed): the caller rejects the
 * candidate and appends these inventory-side statements (retiring the live
 * word), as the old pack publish did.
 */
export type PairInventoryBuild =
  | { readonly kind: 'statement'; readonly statement: D1PreparedStatement }
  | { readonly kind: 'unpublishable'; readonly statements: readonly D1PreparedStatement[] };

const pairCandidateRowSchema = z.strictObject({
  id: z.string(),
  category: z.string(),
  material_json: z.string(),
});

/** Review one locked pair candidate: claim, reviewBatch, store the outcome. */
export async function reviewPairCandidate<TCandidate, TReview, TCategory>(
  db: D1Database,
  env: Env,
  candidateId: string,
  deps: PairCandidateDeps<TCandidate, TReview, TCategory>,
  context: AiCorrelation,
): Promise<boolean> {
  const row = pairCandidateRowSchema.parse(
    await db
      .prepare(`SELECT id, category, material_json FROM ${deps.table} WHERE id = ?`)
      .bind(candidateId)
      .first(),
  );
  const category = deps.parseCategory(row.category);
  const material: unknown = JSON.parse(row.material_json);
  const candidate = deps.parseCandidates({ candidates: [material] }, category)[0];
  if (candidate === undefined) throw new Error('Word candidate material missing');
  const id = await deps.getCandidateId(candidate);
  await claimEditorialModelRequest(
    db,
    `manual-review:${deps.game}:${id}:${crypto.randomUUID()}`,
    deps.game,
    deps.model,
    'review',
    Date.now(),
    { force: true },
  );
  const reviews = await deps
    .createProvider(env.GEMINI_API_KEY)
    .reviewBatch(category, [candidate], context);
  const review = reviews[0];
  if (review === undefined) throw new Error('Word review missing');
  const parsed = deps.parseReviews({ reviews: [review] }, [candidate])[0];
  if (parsed === undefined) throw new Error('Word review missing');
  const isAccepted = deps.isReviewAccepted(parsed);
  await storePairReviewOutcome(
    db,
    deps.table,
    id,
    deps.reviewVersion,
    deps.promptVersion,
    review,
    isAccepted,
  );
  return isAccepted;
}

/**
 * Publish passed pair candidates in one atomic batch. The publish gate
 * mirrors the submission publish gate: the stored review must be an
 * acceptance under the current review version. A candidate that fails the
 * gate stays 'passed' (skipped here, re-reviewable).
 */
export async function publishPairCandidates<TCandidate, TReview, TCategory>(
  db: D1Database,
  candidateIds: readonly string[],
  deps: PairCandidateDeps<TCandidate, TReview, TCategory>,
): Promise<{ readonly publishedIds: readonly string[]; readonly rejectedIds: readonly string[] }> {
  if (candidateIds.length === 0) return { publishedIds: [], rejectedIds: [] };
  const rows = z.array(pairCandidateRowSchema).parse(
    (
      await db
        .prepare(
          `SELECT id, category, material_json FROM ${deps.table}
           WHERE id IN (${placeholders(candidateIds.length)})
           ORDER BY created_at, id`,
        )
        .bind(...candidateIds)
        .all()
    ).results,
  );
  const publishedIds: string[] = [];
  const rejectedIds: string[] = [];
  const statements: D1PreparedStatement[] = [];
  // Per candidate, the position of its status UPDATE inside `statements`
  // (its RETURNING result decides whether this call published it).
  const statusUpdateIndexes: number[] = [];
  for (const row of rows) {
    const now = new Date().toISOString();
    const stored = await loadStoredPairReview(db, deps.table, row.id);
    const material: unknown = JSON.parse(row.material_json);
    let accepted: {
      readonly candidate: TCandidate;
      readonly stored: StoredCandidateReview;
    } | null = null;
    if (stored !== null && stored.reviewVersion === deps.reviewVersion) {
      // The stored category is a plain string; narrow it to the game's
      // category before parsing the material (a corrupt row throws here).
      const category = deps.parseCategory(row.category);
      const candidate = deps.parseCandidates({ candidates: [material] }, category)[0];
      if (candidate !== undefined) {
        const review = deps.parseReviews({ reviews: [stored.review] }, [candidate])[0];
        if (review !== undefined && deps.isReviewAccepted(review)) {
          accepted = { candidate, stored };
        }
      }
    }
    if (accepted === null) {
      rejectedIds.push(row.id);
      continue;
    }
    const inventory = await deps.buildInventory(db, accepted.candidate, accepted.stored, now);
    if (inventory.kind === 'unpublishable') {
      statements.push(
        db
          .prepare(
            `UPDATE ${deps.table} SET status = 'rejected' WHERE id = ? AND status = 'passed'`,
          )
          .bind(row.id),
        ...inventory.statements,
      );
      rejectedIds.push(row.id);
      continue;
    }
    statements.push(inventory.statement);
    statusUpdateIndexes.push(statements.length);
    statements.push(
      db
        .prepare(
          `UPDATE ${deps.table} SET status = 'published', reviewed_at = ?
           WHERE id = ? AND status = 'passed' RETURNING id`,
        )
        .bind(now, row.id),
    );
  }
  if (statements.length > 0) {
    const results = await db.batch(statements);
    for (const index of statusUpdateIndexes) {
      const returned = z
        .array(z.strictObject({ id: z.string() }))
        .parse(results[index]?.results ?? []);
      for (const item of returned) publishedIds.push(item.id);
    }
  }
  return { publishedIds, rejectedIds };
}
