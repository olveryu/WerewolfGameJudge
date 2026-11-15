/**
 * Manual candidate review/publish for fibking, composed in the Worker game
 * catalog. Fibking keeps its own adapter because its evidence check and
 * review-row storage differ from the pair games (reviews live in
 * fib_word_candidate_reviews, not in the candidate row).
 *
 * No monthly-target guard: the user ruled on 2026-11-14 that there are no
 * more limits on how many words may be published per month, for the whole
 * library (all three games).
 */
import { z } from 'zod';

import type { Env } from '../../env';
import type { AiCorrelation } from '../../platform/ai/aiError';
import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import type { WordCandidateReviewAdapter } from '../../platform/wordSupply/candidateReviewAdapter';
import { createConfiguredFibWordProvider } from './wordProviders';
import {
  assertFibWordReviewEvidence,
  deriveFibWordReviewDecision,
  parseFibWordEditorialCandidate,
} from './wordProviders/candidate';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import { extractFibWordEvidence, searchFibWordEvidence } from './wordProviders/tavily';
import type { FibWordEditorialCandidate, FibWordReview } from './wordProviders/types';

const fibCandidateRowSchema = z.strictObject({
  id: z.string(),
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  category: z.string(),
  topic: z.string().nullable(),
  source: z.string(),
  evidence_json: z.string(),
  generation_cycle_id: z.string(),
});

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Review one fibking candidate: verify evidence first when it has none,
 * then run the independent review and store the review record. */
async function reviewFibWordCandidate(
  db: D1Database,
  env: Env,
  candidate: FibWordEditorialCandidate & { readonly id: string; readonly cycleId: string },
  context: AiCorrelation,
): Promise<boolean> {
  let current = candidate;
  if (current.evidence.length === 0) {
    const sources = await searchFibWordEvidence(
      env.TAVILY_API_KEY,
      `"${current.word}" 词典 释义 出处`,
    );
    let evidence = current.evidence;
    if (sources.length > 0) {
      const extraction = await extractFibWordEvidence(env.TAVILY_API_KEY, sources);
      evidence = extraction.evidence;
    }
    const verified = { ...current, evidence };
    await db
      .prepare(
        `UPDATE fib_word_candidates SET evidence_json = ? WHERE id = ? AND status = 'reviewing'`,
      )
      .bind(JSON.stringify(evidence), current.id)
      .run();
    current = verified;
  }
  await claimEditorialModelRequest(
    db,
    `manual-review:fibking:${current.id}:${crypto.randomUUID()}`,
    'fibking',
    GEMINI_FIB_WORD_MODEL,
    'review',
    Date.now(),
    { force: true },
  );
  const reviews = await createConfiguredFibWordProvider(env).reviewBatch(
    {
      category: current.category,
      evidence: [],
      deadlineAt: Date.now() + 120_000,
      signal: AbortSignal.timeout(120_000),
    },
    [current],
    context,
  );
  const review = reviews[0];
  if (review === undefined) throw new Error('Fib word review missing');
  assertFibWordReviewEvidence(current, review);
  const isAccepted = deriveFibWordReviewDecision(review.qualityChecks) === 'accepted';
  const checks = review.qualityChecks;
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO fib_word_candidate_reviews (
          id, word, core_meaning, usage_note, category, source,
          is_established_term, is_definition_accurate,
          is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
          has_multiple_plausible_wrong_definitions, has_reveal_value,
          decision, reason, review_version, generation_cycle_id, reviewed_at,
          evidence_json, evidence_index, evidence_quote
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `${current.id}:manual:${crypto.randomUUID()}`,
        current.word,
        current.definition.coreMeaning,
        current.definition.usageNote,
        current.category,
        current.source,
        Number(checks.isEstablishedTerm),
        Number(checks.isDefinitionAccurate),
        Number(checks.isMeaningUnfamiliarToMostPlayers),
        Number(checks.isMeaningDistinctFromLiteralReading),
        Number(checks.hasMultiplePlausibleWrongDefinitions),
        Number(checks.hasRevealValue),
        review.decision,
        review.reason,
        FIB_WORD_REVIEW_VERSION,
        current.cycleId,
        now,
        JSON.stringify(current.evidence),
        review.evidenceIndex,
        review.evidenceQuote,
      ),
    db
      .prepare(`UPDATE fib_word_candidates SET status = ? WHERE id = ? AND status = 'reviewing'`)
      .bind(isAccepted ? 'passed' : 'rejected', current.id),
  ]);
  return isAccepted;
}

export const fibCandidateReviewAdapter: WordCandidateReviewAdapter = {
  game: 'fibking',
  model: GEMINI_FIB_WORD_MODEL,
  reviewVersion: FIB_WORD_REVIEW_VERSION,
  async reviewCandidate(db, env, candidateId, context) {
    const row = fibCandidateRowSchema.parse(
      await db
        .prepare(
          `SELECT id, word, core_meaning, usage_note, category, topic, source,
             evidence_json, generation_cycle_id
           FROM fib_word_candidates WHERE id = ?`,
        )
        .bind(candidateId)
        .first(),
    );
    const evidence: unknown = JSON.parse(row.evidence_json);
    const candidate = {
      ...parseFibWordEditorialCandidate({
        word: row.word,
        definition: { coreMeaning: row.core_meaning, usageNote: row.usage_note },
        category: row.category,
        ...(row.topic === null ? {} : { topic: row.topic }),
        source: row.source,
        evidence,
      }),
      id: row.id,
      cycleId: row.generation_cycle_id,
    };
    return reviewFibWordCandidate(db, env, candidate, context);
  },
  async publishCandidates(db, candidateIds) {
    if (candidateIds.length === 0) return { publishedIds: [], rejectedIds: [] };
    // The stored review is the latest accepted review row for this
    // candidate's cycle and word, under the current review version.
    const now = new Date().toISOString();
    const publishedIds: string[] = [];
    const rejectedIds: string[] = [];
    const statements: D1PreparedStatement[] = [];
    // Per candidate, the position of its status UPDATE inside `statements`
    // (its RETURNING result decides whether this call published it).
    const statusUpdateIndexes: number[] = [];
    const fibRows = z.array(fibCandidateRowSchema).parse(
      (
        await db
          .prepare(
            `SELECT id, word, core_meaning, usage_note, category, topic, source,
                evidence_json, generation_cycle_id
               FROM fib_word_candidates
               WHERE id IN (${placeholders(candidateIds.length)})
               ORDER BY created_at, id`,
          )
          .bind(...candidateIds)
          .all()
      ).results,
    );
    const cycleIds = [
      ...new Set(
        fibRows
          .map((row) => row.generation_cycle_id)
          .filter((id): id is string => id !== undefined),
      ),
    ];
    const alreadySequenced = new Set<string>();
    if (fibRows.length > 0) {
      const rows = await db
        .prepare(
          `SELECT word FROM fib_word_sequence
           WHERE word IN (${placeholders(fibRows.length)})`,
        )
        .bind(...fibRows.map((row) => row.word))
        .all();
      for (const row of z.array(z.strictObject({ word: z.string() })).parse(rows.results)) {
        alreadySequenced.add(row.word);
      }
    }
    const newlySequencedByCycle = new Map<string, number>();
    const publishingIdsByCycle = new Map<string, string[]>();
    for (const row of fibRows) {
      const reviewRow = z
        .strictObject({
          is_established_term: z.number(),
          is_definition_accurate: z.number(),
          is_meaning_unfamiliar_to_most_players: z.number(),
          is_meaning_distinct_from_literal_reading: z.number(),
          has_multiple_plausible_wrong_definitions: z.number(),
          has_reveal_value: z.number(),
          decision: z.string(),
          evidence_index: z.number().nullable(),
          evidence_quote: z.string().nullable(),
        })
        .nullable()
        .parse(
          await db
            .prepare(
              `SELECT is_established_term, is_definition_accurate,
                is_meaning_unfamiliar_to_most_players,
                is_meaning_distinct_from_literal_reading,
                has_multiple_plausible_wrong_definitions, has_reveal_value,
                decision, evidence_index, evidence_quote
               FROM fib_word_candidate_reviews
               WHERE generation_cycle_id = ? AND word = ?
                 AND review_version = ? AND decision = 'accepted'
               ORDER BY reviewed_at DESC LIMIT 1`,
            )
            .bind(row.generation_cycle_id, row.word, FIB_WORD_REVIEW_VERSION)
            .first(),
        );
      if (reviewRow === null) {
        // No accepted review under the current version: the candidate stays
        // 'passed' (re-reviewable) but is reported as rejected by this
        // publish call.
        rejectedIds.push(row.id);
        continue;
      }
      const evidence: unknown = JSON.parse(row.evidence_json);
      const parsedCandidate = parseFibWordEditorialCandidate({
        word: row.word,
        definition: { coreMeaning: row.core_meaning, usageNote: row.usage_note },
        category: row.category,
        ...(row.topic === null ? {} : { topic: row.topic }),
        source: row.source,
        evidence,
      });
      const review: FibWordReview = {
        word: row.word,
        decision: 'accepted',
        reason: '',
        qualityChecks: {
          isEstablishedTerm: reviewRow.is_established_term === 1,
          isDefinitionAccurate: reviewRow.is_definition_accurate === 1,
          isMeaningUnfamiliarToMostPlayers: reviewRow.is_meaning_unfamiliar_to_most_players === 1,
          isMeaningDistinctFromLiteralReading:
            reviewRow.is_meaning_distinct_from_literal_reading === 1,
          hasMultiplePlausibleWrongDefinitions:
            reviewRow.has_multiple_plausible_wrong_definitions === 1,
          hasRevealValue: reviewRow.has_reveal_value === 1,
        },
        evidenceIndex: reviewRow.evidence_index,
        evidenceQuote: reviewRow.evidence_quote,
      };
      let isAccepted = false;
      try {
        assertFibWordReviewEvidence(parsedCandidate, review);
        isAccepted = deriveFibWordReviewDecision(review.qualityChecks) === 'accepted';
      } catch {
        isAccepted = false;
      }
      if (!isAccepted) {
        rejectedIds.push(row.id);
        continue;
      }
      statements.push(
        db
          .prepare(
            `INSERT INTO fib_words
               (id, word, core_meaning, usage_note, category, topic, source, status,
                selection_key, generation_cycle_id, created_at, activated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)
             ON CONFLICT(word) DO UPDATE SET
               topic = COALESCE(excluded.topic, CASE WHEN fib_words.core_meaning = excluded.core_meaning
                 AND fib_words.usage_note = excluded.usage_note THEN fib_words.topic ELSE NULL END),
               core_meaning = excluded.core_meaning, usage_note = excluded.usage_note,
               category = excluded.category, source = excluded.source, status = 'active',
               activated_at = excluded.activated_at, disabled_at = NULL,
               status_reason = NULL`,
          )
          .bind(
            row.id,
            row.word,
            row.core_meaning,
            row.usage_note,
            row.category,
            row.topic,
            row.source,
            row.generation_cycle_id,
            now,
            now,
          ),
        db
          .prepare(
            `INSERT INTO fib_word_sequence (word, published_at, pack_id)
             VALUES (?, ?, ?) ON CONFLICT(word) DO NOTHING`,
          )
          .bind(row.word, now, row.generation_cycle_id),
      );
      if (!alreadySequenced.has(row.word)) {
        newlySequencedByCycle.set(
          row.generation_cycle_id,
          (newlySequencedByCycle.get(row.generation_cycle_id) ?? 0) + 1,
        );
      }
      const publishingIds = publishingIdsByCycle.get(row.generation_cycle_id) ?? [];
      publishingIds.push(row.id);
      publishingIdsByCycle.set(row.generation_cycle_id, publishingIds);
      statusUpdateIndexes.push(statements.length);
      statements.push(
        db
          .prepare(
            `UPDATE fib_word_candidates SET status = 'published'
             WHERE id = ? AND status = 'passed' RETURNING id`,
          )
          .bind(row.id),
      );
    }
    // Per cycle: the month counter grows only by the words this call newly
    // sequences (re-publishing an already-sequenced word must not count
    // twice), and a cycle completes only when every one of its candidates
    // is resolved.
    for (const cycleId of cycleIds) {
      const newCount = newlySequencedByCycle.get(cycleId) ?? 0;
      if (newCount > 0) {
        statements.push(
          db
            .prepare(
              `INSERT INTO fib_word_supply_months (id, published_count)
               VALUES (substr(?, 1, 7), ?)
               ON CONFLICT(id) DO UPDATE SET published_count = published_count + ?`,
            )
            .bind(now, newCount, newCount),
        );
      }
      // A cycle completes only when every one of its candidates is
      // resolved — counting this call's publishing candidates as resolved,
      // since the batch below moves them to 'published'.
      const publishingIds = publishingIdsByCycle.get(cycleId) ?? [];
      const unresolved = z.strictObject({ count: z.number() }).parse(
        await db
          .prepare(
            `SELECT COUNT(*) AS count FROM fib_word_candidates
               WHERE generation_cycle_id = ? AND status NOT IN ('published', 'rejected')
               ${publishingIds.length === 0 ? '' : `AND id NOT IN (${placeholders(publishingIds.length)})`}`,
          )
          .bind(cycleId, ...publishingIds)
          .first(),
      );
      if (unresolved.count === 0) {
        statements.push(
          db
            .prepare(
              `UPDATE fib_word_generation_cycles
               SET status = 'completed', completed_at = ?,
                 request_count = (SELECT COUNT(*) FROM fib_word_provider_requests
                   WHERE pack_id = ? AND operation IN ('generation', 'review')),
                 accepted_count = (SELECT COUNT(*) FROM fib_word_sequence WHERE pack_id = ?),
                 rejected_count = (SELECT COUNT(*) FROM fib_word_candidate_reviews
                   WHERE generation_cycle_id = ? AND decision = 'rejected')
               WHERE id = ? AND status = 'running'`,
            )
            .bind(now, cycleId, cycleId, cycleId, cycleId),
        );
      }
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
  },
};
