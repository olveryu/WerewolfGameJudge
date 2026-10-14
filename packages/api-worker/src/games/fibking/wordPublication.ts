/** Bounded monthly editorial budget and atomic append-only pack publication in D1. */

import { z } from 'zod';

import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createFailWordPackStatement } from '../../platform/wordSupply/wordPackLedger';
import {
  assertFibWordReviewEvidence,
  deriveFibWordReviewDecision,
  parseFibWordEditorialCandidate,
} from './wordProviders/candidate';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_PROMPT_VERSION, FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import {
  FIB_WORD_CATEGORIES,
  FIB_WORD_GENERATION_BATCH_LIMIT,
  FIB_WORD_REVIEW_BATCH_LIMIT,
  type FibWordEditorialCandidate,
  type FibWordReview,
} from './wordProviders/types';
import { FIB_WORD_SEARCH_QUERY_COUNT } from './wordSearchPlan';

export const FIB_WORD_MONTHLY_TARGET = 100;
/** Monthly batch budget tracks the search plan 1:1 so scheduled supply can reach every query. */
export const FIB_WORD_MONTHLY_BATCH_LIMIT = FIB_WORD_SEARCH_QUERY_COUNT;
export const FIB_WORD_DAILY_BATCH_LIMIT = 4;
const FIB_WORD_TAVILY_REQUEST_LIMIT = 7;
/**
 * Tavily free (Researcher) plan: 1,000 credits/month. Every fibking Tavily
 * operation uses basic search/extract, so each ledger row costs at most one
 * credit and the row count is an upper bound on credits consumed.
 */
export const FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS = 1000;

type FibWordProviderOperation =
  | 'discovery'
  | 'extraction'
  | 'generation'
  | 'review'
  | `verification-${number}`
  | `verification-extraction-${number}`;

const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(FIB_WORD_CATEGORIES),
  request_token: z.string(),
  searchIndex: z
    .number()
    .int()
    .min(0)
    .max(FIB_WORD_SEARCH_QUERY_COUNT - 1),
});
export type FibWordPack = z.output<typeof packSchema>;

/** An uncertain provider operation is consumed permanently, including after Workflow restart. */
export async function claimFibWordProviderRequest(
  db: D1Database,
  pack: FibWordPack,
  operation: FibWordProviderOperation,
  opts: { force?: boolean } = {},
): Promise<void> {
  const result = await db
    .prepare(
      `INSERT INTO fib_word_provider_requests (pack_id, operation)
    SELECT id, ? FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
      AND (? IN ('generation', 'review') OR (
        SELECT COUNT(*) FROM fib_word_provider_requests
        WHERE pack_id = ? AND operation NOT IN ('generation', 'review')
      ) < ?)
    ON CONFLICT (pack_id, operation) DO NOTHING RETURNING pack_id`,
    )
    .bind(operation, pack.id, pack.request_token, operation, pack.id, FIB_WORD_TAVILY_REQUEST_LIMIT)
    .first();
  if (result === null)
    throw new Error('Fib provider operation already consumed, budget exhausted, or pack is closed');
  if (operation === 'generation' || operation === 'review') {
    await claimEditorialModelRequest(
      db,
      `fib:${pack.id}:${operation}`,
      'fibking',
      GEMINI_FIB_WORD_MODEL,
      Date.now(),
      { force: opts.force },
    );
  }
}

/** Reserve at most seven source requests and two model calls; uncertain calls are not refunded. */
export async function reserveFibWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
  opts: { force?: boolean; runId?: string; batchLimit?: number } = {},
): Promise<FibWordPack | null> {
  const batchLimit = opts.batchLimit ?? FIB_WORD_DAILY_BATCH_LIMIT;
  const parsedDay = z.iso.date().parse(day);
  z.int().min(FIB_WORD_DAILY_BATCH_LIMIT).max(FIB_WORD_MONTHLY_BATCH_LIMIT).parse(batchLimit);
  z.int()
    .min(0)
    .max(batchLimit - 1)
    .parse(batchIndex);
  const monthId = parsedDay.slice(0, 7);
  // Manual runs (normal or force) carry a unique runId so repeated triggers on the same
  // day never collide with each other or with the scheduled daily batches. Force mode
  // additionally bypasses the monthly budget below.
  const id = opts.runId
    ? `${parsedDay}-${opts.force ? 'force' : 'manual'}-${opts.runId}-${batchIndex}`
    : `${parsedDay}-${batchIndex}`;
  const requestToken = crypto.randomUUID();
  const category =
    FIB_WORD_CATEGORIES[(Number(parsedDay.slice(-2)) + batchIndex) % FIB_WORD_CATEGORIES.length];
  if (category === undefined) throw new Error('Fib publication category unavailable');
  const quotaClause = opts.force ? '' : 'AND requests_reserved < ? AND published_count < ?';
  const quotaBinds: number[] = opts.force
    ? []
    : [FIB_WORD_MONTHLY_BATCH_LIMIT, FIB_WORD_MONTHLY_TARGET];
  const results = await db.batch([
    db
      .prepare('INSERT INTO fib_word_supply_months (id) VALUES (?) ON CONFLICT (id) DO NOTHING')
      .bind(monthId),
    db
      .prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at)
      SELECT ?, id, ?, ?, 'reserved', ? FROM fib_word_supply_months
      WHERE id = ? ${quotaClause}
        AND EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
      ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
      )
      .bind(id, requestToken, category, new Date().toISOString(), monthId, ...quotaBinds),
    db
      .prepare(
        `UPDATE fib_word_supply_months SET requests_reserved = requests_reserved + 1
      WHERE id = ? AND EXISTS (SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ?)
      RETURNING requests_reserved - 1 AS searchIndex`,
      )
      .bind(monthId, id, requestToken),
    db
      .prepare(
        `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
      SELECT id, 'running', 'gemini', ?, ?, created_at FROM fib_word_packs WHERE id = ? AND request_token = ?`,
      )
      .bind(GEMINI_FIB_WORD_MODEL, FIB_WORD_PROMPT_VERSION, id, requestToken),
  ]);
  const result = results[1];
  if (result === undefined) throw new Error('Fib pack reservation result missing');
  const row = result.results[0];
  if (row === undefined) return null;
  const reservation = results[2];
  if (reservation === undefined) throw new Error('Fib monthly reservation result missing');
  const rawSearchIndex = z
    .strictObject({ searchIndex: z.number().int().min(0) })
    .parse(reservation.results[0]).searchIndex;
  // Force mode cycles through the query plan instead of failing out of range.
  const searchIndex =
    opts.force === true ? rawSearchIndex % FIB_WORD_SEARCH_QUERY_COUNT : rawSearchIndex;
  await db
    .prepare('UPDATE fib_word_packs SET search_index = ? WHERE id = ? AND request_token = ?')
    .bind(searchIndex, id, requestToken)
    .run();
  return packSchema.parse({ ...row, searchIndex });
}

const FIB_WORD_VERIFICATION_REQUEST_COUNT = 2;
const FIB_WORD_UNVERIFIED_REVIEW_LIMIT = Math.floor(
  FIB_WORD_TAVILY_REQUEST_LIMIT / FIB_WORD_VERIFICATION_REQUEST_COUNT,
);

const candidateRowSchema = z.strictObject({
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  category: z.string(),
  source: z.string(),
  evidence_json: z.string(),
});

function parseCandidateRow(value: unknown): FibWordEditorialCandidate {
  const row = candidateRowSchema.parse(value);
  const evidence: unknown = JSON.parse(row.evidence_json);
  return parseFibWordEditorialCandidate({
    word: row.word,
    definition: { coreMeaning: row.core_meaning, usageNote: row.usage_note },
    category: row.category,
    source: row.source,
    evidence,
  });
}

/** Keep every extracted candidate, including overflow; identical reviewed evidence is not requeued. */
export async function storeFibWordCandidates(
  db: D1Database,
  pack: FibWordPack,
  candidates: readonly FibWordEditorialCandidate[],
): Promise<void> {
  if (candidates.length > FIB_WORD_GENERATION_BATCH_LIMIT) {
    throw new Error('Fib candidate intake exceeds batch limit');
  }
  if (candidates.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(
    candidates.map((value, index) => {
      const candidate = parseFibWordEditorialCandidate(value);
      if (candidate.evidence.length === 0)
        throw new Error('Extracted Fib candidate has no evidence');
      const evidenceJson = JSON.stringify(candidate.evidence);
      return db
        .prepare(
          `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, id, 'pending', ? FROM fib_word_packs
           WHERE id = ? AND request_token = ? AND status = 'reserved'
             AND NOT EXISTS (
               SELECT 1 FROM fib_word_candidate_reviews WHERE word = ? AND core_meaning = ?
                 AND usage_note = ? AND review_version = ? AND evidence_json = ?
             )
           ON CONFLICT (word) DO NOTHING`,
        )
        .bind(
          `${pack.id}:${index}`,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          candidate.category,
          candidate.source,
          evidenceJson,
          now,
          pack.id,
          pack.request_token,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          FIB_WORD_REVIEW_VERSION,
          evidenceJson,
        );
    }),
  );
}

/** Atomically prioritize stale inventory and claim a replay-stable, mixed-category review batch. */
export async function getFibWordReviewCandidates(
  db: D1Database,
  pack: FibWordPack,
): Promise<FibWordEditorialCandidate[]> {
  const now = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, source,
         evidence_json, generation_cycle_id, status, created_at)
         SELECT ? || ':inventory:' || inventory.word, inventory.word, core_meaning, usage_note,
           category, source, COALESCE((
             SELECT evidence_json FROM fib_word_candidate_reviews AS previous
             WHERE previous.word = inventory.word AND previous.core_meaning = inventory.core_meaning
               AND previous.usage_note = inventory.usage_note AND evidence_json IS NOT NULL
             ORDER BY reviewed_at DESC LIMIT 1
           ), '[]'), ?, 'pending', ? FROM fib_words AS inventory
         WHERE status = 'active' AND NOT EXISTS (
           SELECT 1 FROM fib_word_candidate_reviews AS review
           WHERE review.word = inventory.word AND review.review_version = ?
             AND review.decision = 'accepted' AND review.core_meaning = inventory.core_meaning
             AND review.usage_note = inventory.usage_note AND review.reviewed_at >= inventory.activated_at
         ) AND EXISTS (
           SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
         ) AND NOT EXISTS (SELECT 1 FROM fib_word_candidates WHERE claimed_pack_id = ?)
         ORDER BY activated_at, word LIMIT ?
         ON CONFLICT (word) DO UPDATE SET core_meaning = excluded.core_meaning,
           usage_note = excluded.usage_note, category = excluded.category,
           source = excluded.source, evidence_json = CASE
             WHEN fib_word_candidates.core_meaning = excluded.core_meaning
               AND fib_word_candidates.usage_note = excluded.usage_note
               AND json_array_length(fib_word_candidates.evidence_json) > 0
             THEN fib_word_candidates.evidence_json ELSE excluded.evidence_json END
         WHERE fib_word_candidates.status = 'pending'`,
      )
      .bind(
        pack.id,
        pack.id,
        now,
        FIB_WORD_REVIEW_VERSION,
        pack.id,
        pack.request_token,
        pack.id,
        FIB_WORD_REVIEW_BATCH_LIMIT,
      ),
    db
      .prepare(
        `UPDATE fib_word_candidates SET status = 'claimed', claimed_pack_id = ?, claimed_at = ?
         WHERE rowid IN (
           SELECT candidate.rowid FROM fib_word_candidates AS candidate WHERE status = 'pending'
           ORDER BY EXISTS (SELECT 1 FROM fib_words WHERE word = candidate.word AND status = 'active') DESC,
             created_at, candidate.rowid LIMIT CASE WHEN EXISTS (
               SELECT 1 FROM fib_word_candidates WHERE status = 'pending' AND json_array_length(evidence_json) = 0
             ) THEN ? ELSE ? END
         ) AND EXISTS (
           SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
         ) AND NOT EXISTS (SELECT 1 FROM fib_word_candidates WHERE claimed_pack_id = ?)`,
      )
      .bind(
        pack.id,
        now,
        FIB_WORD_UNVERIFIED_REVIEW_LIMIT,
        FIB_WORD_REVIEW_BATCH_LIMIT,
        pack.id,
        pack.request_token,
        pack.id,
      ),
    db
      .prepare(
        `SELECT word, core_meaning, usage_note, category, source, evidence_json
         FROM fib_word_candidates WHERE claimed_pack_id = ? AND EXISTS (
           SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
         ) ORDER BY EXISTS (SELECT 1 FROM fib_words WHERE word = fib_word_candidates.word AND status = 'active') DESC,
           created_at, rowid`,
      )
      .bind(pack.id, pack.id, pack.request_token),
  ]);
  const result = results[2];
  if (result === undefined) throw new Error('Fib candidate claim result missing');
  return result.results.map(parseCandidateRow);
}

function reviewStatement(
  db: D1Database,
  pack: FibWordPack,
  candidate: FibWordEditorialCandidate,
  review: FibWordReview,
  index: number,
  now: string,
) {
  const checks = review.qualityChecks;
  return db
    .prepare(
      `INSERT INTO fib_word_candidate_reviews (
    id, word, core_meaning, usage_note, category, source,
    is_established_term, is_definition_accurate,
    is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
    has_multiple_plausible_wrong_definitions, has_reveal_value,
    decision, reason, review_version, generation_cycle_id, reviewed_at,
    evidence_json, evidence_index, evidence_quote
  ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'`,
    )
    .bind(
      `${pack.id}:${index}`,
      candidate.word,
      candidate.definition.coreMeaning,
      candidate.definition.usageNote,
      candidate.category,
      candidate.source,
      Number(checks.isEstablishedTerm),
      Number(checks.isDefinitionAccurate),
      Number(checks.isMeaningUnfamiliarToMostPlayers),
      Number(checks.isMeaningDistinctFromLiteralReading),
      Number(checks.hasMultiplePlausibleWrongDefinitions),
      Number(checks.hasRevealValue),
      review.decision,
      review.reason,
      FIB_WORD_REVIEW_VERSION,
      pack.id,
      now,
      JSON.stringify(candidate.evidence),
      review.evidenceIndex,
      review.evidenceQuote,
      pack.id,
      pack.request_token,
    );
}

/** Apply current reviews and append unseen words; replay cannot append or charge twice. */
export async function publishFibWordPack(
  db: D1Database,
  pack: FibWordPack,
  candidates: readonly FibWordEditorialCandidate[],
  reviews: readonly FibWordReview[],
  opts: { readonly sourceUrls: readonly string[] } = { sourceUrls: [] },
): Promise<void> {
  if (candidates.length > FIB_WORD_REVIEW_BATCH_LIMIT || reviews.length !== candidates.length)
    throw new Error('Fib publication batch size mismatch');
  const sourceUrls = z.array(z.url()).max(14).parse(opts.sourceUrls);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const review = reviews[index];
    if (review === undefined || review.word !== candidate.word)
      throw new Error('Fib publication review mismatch');
    if (review.decision !== deriveFibWordReviewDecision(review.qualityChecks))
      throw new Error('Fib publication review decision mismatches quality checks');
    assertFibWordReviewEvidence(candidate, review);
    statements.push(reviewStatement(db, pack, candidate, review, index, now));
    if (review.decision === 'rejected') {
      statements.push(
        db
          .prepare(
            `UPDATE fib_words SET status = 'disabled', disabled_at = ?, status_reason = 'quality_review: rejected'
        WHERE word = ? AND status = 'active' AND EXISTS (
          SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
          )
          .bind(now, candidate.word, pack.id, pack.request_token),
      );
      continue;
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
      selection_key, generation_cycle_id, created_at, activated_at)
      SELECT ?, ?, ?, ?, ?, ?, 'active', 0, id, ?, ? FROM fib_word_packs
      WHERE id = ? AND request_token = ? AND status = 'reserved'
        AND (EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = ?)
          OR (SELECT published_count FROM fib_word_supply_months WHERE id = month_id)
          + (SELECT COUNT(*) FROM fib_words AS candidate_word
             WHERE generation_cycle_id = fib_word_packs.id
               AND NOT EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = candidate_word.word)) < ?)
      ON CONFLICT (word) DO UPDATE SET
        core_meaning = excluded.core_meaning, usage_note = excluded.usage_note,
        category = excluded.category, source = excluded.source, status = 'active',
        activated_at = excluded.activated_at, disabled_at = NULL, status_reason = NULL`,
        )
        .bind(
          `${pack.id}:${index}`,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          candidate.category,
          candidate.source,
          now,
          now,
          pack.id,
          pack.request_token,
          candidate.word,
          FIB_WORD_MONTHLY_TARGET,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO fib_word_sequence (word, published_at, pack_id)
      SELECT word.word, ?, pack.id FROM fib_words AS word
      INNER JOIN fib_word_candidate_reviews AS review ON review.word = word.word AND review.decision = 'accepted'
      INNER JOIN fib_word_packs AS pack ON pack.id = review.generation_cycle_id
      WHERE pack.id = ? AND pack.request_token = ? AND pack.status = 'reserved' AND word.status = 'active'
      ORDER BY word.id ON CONFLICT (word) DO NOTHING`,
      )
      .bind(now, pack.id, pack.request_token),
    db
      .prepare(
        `UPDATE fib_word_supply_months SET published_count = published_count + (
      SELECT COUNT(*) FROM fib_word_sequence WHERE pack_id = ?)
      WHERE id = (SELECT month_id FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
      )
      .bind(pack.id, pack.id, pack.request_token),
    db
      .prepare(
        `UPDATE fib_word_generation_cycles SET status = 'completed', completed_at = ?,
      request_count = (SELECT COUNT(*) FROM fib_word_provider_requests WHERE pack_id = ? AND operation IN ('generation', 'review')),
      accepted_count = (SELECT COUNT(*) FROM fib_word_sequence WHERE pack_id = ?),
      rejected_count = (SELECT COUNT(*) FROM fib_word_candidate_reviews WHERE generation_cycle_id = ? AND decision = 'rejected')
      WHERE id = ? AND status = 'running'`,
      )
      .bind(now, pack.id, pack.id, pack.id, pack.id),
    db
      .prepare(
        `DELETE FROM fib_word_candidates WHERE claimed_pack_id = ? AND EXISTS (
          SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')
        AND (EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = fib_word_candidates.word)
          OR EXISTS (SELECT 1 FROM fib_word_candidate_reviews
            WHERE generation_cycle_id = claimed_pack_id AND word = fib_word_candidates.word
              AND decision = 'rejected'))`,
      )
      .bind(pack.id, pack.id, pack.request_token),
    db
      .prepare(
        `UPDATE fib_word_candidates SET status = 'pending', claimed_pack_id = NULL, claimed_at = NULL
        WHERE claimed_pack_id = ? AND EXISTS (
          SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
      )
      .bind(pack.id, pack.id, pack.request_token),
    db
      .prepare(
        `UPDATE fib_word_packs SET status = 'published', published_at = ?, source_json = ?, outcome = ?
      WHERE id = ? AND request_token = ? AND status = 'reserved'`,
      )
      .bind(
        now,
        JSON.stringify(sourceUrls),
        candidates.length === 0
          ? 'noCandidates'
          : reviews.every(({ decision }) => decision === 'rejected')
            ? 'allRejected'
            : 'reviewed',
        pack.id,
        pack.request_token,
      ),
  );
  await db.batch(statements);
}

/** Mark a failed pack terminal without refunding potentially consumed external quota. */
export async function failFibWordPack(
  db: D1Database,
  pack: FibWordPack,
  errorCode: string,
): Promise<void> {
  await db.batch([
    createFailWordPackStatement(db, 'fib_word_packs', pack, errorCode),
    db
      .prepare(
        "UPDATE fib_word_generation_cycles SET status = 'failed', completed_at = ?, error_code = ? WHERE id = ? AND status = 'running'",
      )
      .bind(new Date().toISOString(), errorCode, pack.id),
    db
      .prepare(
        `UPDATE fib_word_candidates SET status = 'pending', claimed_pack_id = NULL, claimed_at = NULL
         WHERE claimed_pack_id = ? AND EXISTS (
           SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'failed')`,
      )
      .bind(pack.id, pack.id, pack.request_token),
  ]);
}
