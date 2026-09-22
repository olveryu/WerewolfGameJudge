/** Transactional editorial queue and publication; pair identity survives reviews and retirement. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import {
  getUndercoverPairId,
  isUndercoverReviewAccepted,
  parseUndercoverCandidates,
  parseUndercoverReviews,
  UNDERCOVER_WORD_BATCH_LIMIT,
  UNDERCOVER_WORD_PROMPT_VERSION,
  UNDERCOVER_WORD_REVIEW_VERSION,
  type UndercoverWordCandidate,
  type UndercoverWordReview,
} from './wordEditorial';
import { UNDERCOVER_WORD_MODEL } from './wordProvider';

export const UNDERCOVER_DAILY_BATCH_LIMIT = 2;
const REVIEW_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(UNDERCOVER_CATEGORIES),
  request_token: z.string(),
});
export type UndercoverWordPack = z.output<typeof packSchema>;

/** Reserve a category with queued work first, then the least active inventory. */
export async function reserveUndercoverWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
): Promise<UndercoverWordPack | null> {
  z.iso.date().parse(day);
  z.int()
    .min(0)
    .max(UNDERCOVER_DAILY_BATCH_LIMIT - 1)
    .parse(batchIndex);
  const categoryRows = await db
    .prepare(
      `SELECT category,
      (SELECT COUNT(*) FROM undercover_word_candidates candidate WHERE candidate.category = category_list.value AND (
        (candidate.status = 'pending' AND (candidate.claimed_pack_id IS NULL OR EXISTS (SELECT 1 FROM undercover_word_packs pack WHERE pack.id = candidate.claimed_pack_id AND pack.status = 'failed')))
        OR (candidate.status = 'accepted' AND (candidate.reviewed_at < ? OR EXISTS (SELECT 1 FROM undercover_word_pairs pair WHERE pair.id = candidate.id AND json_extract(pair.review_json, '$.reviewVersion') != ?))))) AS pending_count,
      (SELECT COUNT(*) FROM undercover_word_pairs pair WHERE pair.category = category_list.value AND pair.status = 'active') AS active_count
    FROM (SELECT value, value AS category FROM json_each(?)) category_list
    ORDER BY pending_count DESC, active_count ASC,
      COALESCE((SELECT MAX(created_at) FROM undercover_word_packs previous WHERE previous.category = category_list.value), '') ASC,
      category ASC LIMIT 1`,
    )
    .bind(
      new Date(Date.now() - REVIEW_INTERVAL_MS).toISOString(),
      UNDERCOVER_WORD_REVIEW_VERSION,
      JSON.stringify(UNDERCOVER_CATEGORIES),
    )
    .first();
  const { category } = packSchema
    .pick({ category: true })
    .extend({ pending_count: z.int(), active_count: z.int() })
    .parse(categoryRows);
  const row = await db
    .prepare(
      `INSERT INTO undercover_word_packs (id, category, request_token, status, created_at, model, prompt_version, review_version)
    SELECT ?, ?, ?, 'reserved', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
    ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
    )
    .bind(
      `${day}-${batchIndex}`,
      category,
      crypto.randomUUID(),
      new Date().toISOString(),
      UNDERCOVER_WORD_MODEL,
      UNDERCOVER_WORD_PROMPT_VERSION,
      UNDERCOVER_WORD_REVIEW_VERSION,
    )
    .first();
  return row === null ? null : packSchema.parse(row);
}

/** Persist validated generated material without duplicating any previously reviewed identity. */
export async function storeUndercoverWordCandidates(
  db: D1Database,
  pack: UndercoverWordPack,
  candidates: readonly UndercoverWordCandidate[],
): Promise<void> {
  const parsed = parseUndercoverCandidates({ candidates }, pack.category);
  const statements: D1PreparedStatement[] = [];
  for (const candidate of parsed) {
    statements.push(
      db
        .prepare(
          `INSERT INTO undercover_word_candidates (id, word_a, word_b, category, material_json, status, created_at)
      SELECT ?, ?, ?, ?, ?, 'pending', ? FROM undercover_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
      ON CONFLICT (id) DO NOTHING`,
        )
        .bind(
          await getUndercoverPairId(candidate.wordA, candidate.wordB),
          candidate.wordA,
          candidate.wordB,
          candidate.category,
          JSON.stringify(candidate),
          new Date().toISOString(),
          pack.id,
          pack.request_token,
        ),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}

/** Claim pending material or due published reviews; crashed requests leave the prior inventory intact. */
export async function getUndercoverReviewCandidates(
  db: D1Database,
  pack: UndercoverWordPack,
): Promise<UndercoverWordCandidate[]> {
  const now = Date.now();
  const results = await db.batch([
    db
      .prepare(
        `UPDATE undercover_word_candidates SET status = 'pending', claimed_pack_id = NULL
      WHERE category = ? AND status = 'accepted' AND (reviewed_at < ? OR EXISTS (
        SELECT 1 FROM undercover_word_pairs pair WHERE pair.id = undercover_word_candidates.id
          AND json_extract(pair.review_json, '$.reviewVersion') != ?))`,
      )
      .bind(
        pack.category,
        new Date(now - REVIEW_INTERVAL_MS).toISOString(),
        UNDERCOVER_WORD_REVIEW_VERSION,
      ),
    db
      .prepare(
        `UPDATE undercover_word_candidates SET claimed_pack_id = ?
      WHERE id IN (SELECT id FROM undercover_word_candidates WHERE category = ? AND status = 'pending'
        AND (claimed_pack_id IS NULL OR claimed_pack_id = ? OR EXISTS (SELECT 1 FROM undercover_word_packs failed WHERE failed.id = claimed_pack_id AND failed.status = 'failed'))
        ORDER BY created_at, id LIMIT ?)
      AND EXISTS (SELECT 1 FROM undercover_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')
      RETURNING material_json`,
      )
      .bind(
        pack.id,
        pack.category,
        pack.id,
        UNDERCOVER_WORD_BATCH_LIMIT,
        pack.id,
        pack.request_token,
      ),
  ]);
  const rows = results[1];
  if (rows === undefined) throw new Error('Undercover candidate claim result missing');
  const candidates = rows.results.map((row) => {
    const { material_json } = z.strictObject({ material_json: z.string() }).parse(row);
    const value: unknown = JSON.parse(material_json);
    return value;
  });
  return parseUndercoverCandidates({ candidates }, pack.category);
}

/** Publish accepted pairs and retire rejected prior pairs in the same replay-safe transaction. */
export async function publishUndercoverWordPack(
  db: D1Database,
  pack: UndercoverWordPack,
  candidates: readonly UndercoverWordCandidate[],
  reviews: readonly UndercoverWordReview[],
): Promise<void> {
  const parsedCandidates = parseUndercoverCandidates({ candidates }, pack.category);
  const parsedReviews = parseUndercoverReviews({ reviews }, parsedCandidates);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const [index, candidate] of parsedCandidates.entries()) {
    const review = parsedReviews[index];
    if (review === undefined) throw new Error('Undercover publication review missing');
    const id = await getUndercoverPairId(candidate.wordA, candidate.wordB);
    const isAccepted = isUndercoverReviewAccepted(review);
    const reviewJson = JSON.stringify({
      reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
      promptVersion: UNDERCOVER_WORD_PROMPT_VERSION,
      packId: pack.id,
      review,
    });
    statements.push(
      db
        .prepare(
          `UPDATE undercover_word_candidates SET status = ?, reviewed_at = ?
      WHERE id = ? AND claimed_pack_id = ? AND EXISTS (SELECT 1 FROM undercover_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
        )
        .bind(isAccepted ? 'accepted' : 'rejected', now, id, pack.id, pack.id, pack.request_token),
    );
    if (isAccepted) {
      statements.push(
        db
          .prepare(
            `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
        SELECT ?, ?, ?, ?, 'active', ?, ?, ? FROM undercover_word_candidates candidate
        WHERE candidate.id = ? AND candidate.claimed_pack_id = ? AND candidate.status = 'accepted'
          AND EXISTS (SELECT 1 FROM undercover_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')
        ON CONFLICT (id) DO UPDATE SET category = excluded.category, status = 'active', reviewed_at = excluded.reviewed_at, review_json = excluded.review_json`,
          )
          .bind(
            id,
            candidate.wordA,
            candidate.wordB,
            candidate.category,
            now,
            now,
            reviewJson,
            id,
            pack.id,
            pack.id,
            pack.request_token,
          ),
      );
    } else {
      statements.push(
        db
          .prepare(
            `UPDATE undercover_word_pairs SET status = 'disabled', reviewed_at = ?, review_json = ?
        WHERE id = ? AND EXISTS (SELECT 1 FROM undercover_word_candidates WHERE id = ? AND claimed_pack_id = ? AND status = 'rejected')
          AND EXISTS (SELECT 1 FROM undercover_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved')`,
          )
          .bind(now, reviewJson, id, id, pack.id, pack.id, pack.request_token),
      );
    }
  }
  statements.push(
    db
      .prepare(
        `UPDATE undercover_word_packs SET status = 'published', candidates_json = ?, reviews_json = ?, completed_at = ?
    WHERE id = ? AND request_token = ? AND status = 'reserved'`,
      )
      .bind(
        JSON.stringify(parsedCandidates),
        JSON.stringify(parsedReviews),
        now,
        pack.id,
        pack.request_token,
      ),
  );
  await db.batch(statements);
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failUndercoverWordPack(
  db: D1Database,
  pack: UndercoverWordPack,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE undercover_word_packs SET status = 'failed', failure_reason = ?, completed_at = ?
    WHERE id = ? AND request_token = ? AND status = 'reserved'`,
    )
    .bind(reason, new Date().toISOString(), pack.id, pack.request_token)
    .run();
}
