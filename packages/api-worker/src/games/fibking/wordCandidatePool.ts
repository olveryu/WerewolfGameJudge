/** Persist and claim bounded editorial batches; no candidate becomes playable before publication. */
import { z } from 'zod';

import { parseFibWordEditorialCandidate } from './wordProviders/candidate';
import { FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import {
  FIB_WORD_GENERATION_BATCH_LIMIT,
  FIB_WORD_REVIEW_BATCH_LIMIT,
  type FibWordEditorialCandidate,
} from './wordProviders/types';
import { FIB_WORD_TAVILY_REQUEST_LIMIT, type FibWordPack } from './wordPublication';

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

/** Preserve successful verification across a later provider failure without changing the claim. */
export async function updateFibWordCandidateEvidence(
  db: D1Database,
  pack: FibWordPack,
  candidate: FibWordEditorialCandidate,
): Promise<void> {
  const parsed = parseFibWordEditorialCandidate(candidate);
  const result = await db
    .prepare(
      `UPDATE fib_word_candidates SET evidence_json = ? WHERE word = ? AND claimed_pack_id = ?
       AND status = 'claimed' AND EXISTS (
         SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
       )`,
    )
    .bind(JSON.stringify(parsed.evidence), parsed.word, pack.id, pack.id, pack.request_token)
    .run();
  if (result.meta.changes !== 1) throw new Error('Fib evidence update lost its candidate claim');
}
