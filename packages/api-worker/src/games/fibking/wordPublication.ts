/** Bounded monthly editorial budget and atomic append-only pack publication in D1. */

import { z } from 'zod';

import { assertFibWordReviewEvidence } from './wordProviders/candidate';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_PROMPT_VERSION, FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import {
  FIB_WORD_CATEGORIES,
  FIB_WORD_REVIEW_BATCH_LIMIT,
  type FibWordEditorialCandidate,
  type FibWordReview,
} from './wordProviders/types';

const FIB_WORD_MONTHLY_TARGET = 100;
const FIB_WORD_MONTHLY_BATCH_LIMIT = 60;
export const FIB_WORD_DAILY_BATCH_LIMIT = 4;
export const FIB_WORD_TAVILY_REQUEST_LIMIT = 7;

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
});
export type FibWordPack = z.output<typeof packSchema>;

/** An uncertain provider operation is consumed permanently, including after Workflow restart. */
export async function claimFibWordProviderRequest(
  db: D1Database,
  pack: FibWordPack,
  operation: FibWordProviderOperation,
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
}

/** Reserve at most seven source requests and two model calls; uncertain calls are not refunded. */
export async function reserveFibWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
): Promise<FibWordPack | null> {
  const parsedDay = z.iso.date().parse(day);
  z.int()
    .min(0)
    .max(FIB_WORD_DAILY_BATCH_LIMIT - 1)
    .parse(batchIndex);
  const monthId = parsedDay.slice(0, 7);
  const id = `${parsedDay}-${batchIndex}`;
  const requestToken = crypto.randomUUID();
  const category =
    FIB_WORD_CATEGORIES[(Number(parsedDay.slice(-2)) + batchIndex) % FIB_WORD_CATEGORIES.length];
  if (category === undefined) throw new Error('Fib publication category unavailable');
  const results = await db.batch([
    db
      .prepare('INSERT INTO fib_word_supply_months (id) VALUES (?) ON CONFLICT (id) DO NOTHING')
      .bind(monthId),
    db
      .prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at)
      SELECT ?, id, ?, ?, 'reserved', ? FROM fib_word_supply_months
      WHERE id = ? AND requests_reserved < ? AND published_count < ?
        AND EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
      ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
      )
      .bind(
        id,
        requestToken,
        category,
        new Date().toISOString(),
        monthId,
        FIB_WORD_MONTHLY_BATCH_LIMIT,
        FIB_WORD_MONTHLY_TARGET,
      ),
    db
      .prepare(
        `UPDATE fib_word_supply_months SET requests_reserved = requests_reserved + 1
      WHERE id = ? AND EXISTS (SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ?)`,
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
  return row === undefined ? null : packSchema.parse(row);
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
    is_established_term, is_definition_accurate, is_easy_to_read_aloud,
    is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
    has_multiple_plausible_wrong_definitions, has_reveal_value,
    decision, reason, review_version, generation_cycle_id, reviewed_at,
    evidence_json, evidence_index, evidence_quote
  ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      Number(checks.isEasyToReadAloud),
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
  sourceUrls: readonly string[],
): Promise<void> {
  if (candidates.length > FIB_WORD_REVIEW_BATCH_LIMIT || reviews.length !== candidates.length)
    throw new Error('Fib publication batch size mismatch');
  z.array(z.url()).max(14).parse(sourceUrls);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const review = reviews[index];
    if (review === undefined || review.word !== candidate.word)
      throw new Error('Fib publication review mismatch');
    if (review.decision === 'accepted' && !Object.values(review.qualityChecks).every(Boolean))
      throw new Error('Fib publication accepted failed quality checks');
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
    db
      .prepare(
        "UPDATE fib_word_packs SET status = 'failed' WHERE id = ? AND request_token = ? AND status = 'reserved'",
      )
      .bind(pack.id, pack.request_token),
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
