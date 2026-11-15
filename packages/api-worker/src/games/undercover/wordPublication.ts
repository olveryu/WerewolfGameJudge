/**
 * Transactional editorial queue; pair identity survives reviews and
 * retirement. Supply only generates and stores — review and publication
 * live on the manual review/publish endpoints, never in the workflow.
 */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import { wordCategoryCooldownCutoff } from '../../platform/wordSupply/categoryCooldown';
import {
  createWordPackId,
  failWordPack,
  insertReservedWordPack,
} from '../../platform/wordSupply/wordPackLedger';
import {
  getUndercoverPairId,
  parseUndercoverCandidates,
  UNDERCOVER_WORD_PROMPT_VERSION,
  UNDERCOVER_WORD_REVIEW_VERSION,
  type UndercoverWordCandidate,
} from './wordEditorial';
import { UNDERCOVER_WORD_MODEL } from './wordProvider';

export const UNDERCOVER_DAILY_BATCH_LIMIT = 2;
const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(UNDERCOVER_CATEGORIES),
  request_token: z.string(),
});
export type UndercoverWordPack = z.output<typeof packSchema>;

/** Alternate between the queued (pending/approved) candidates and the smallest active inventory. */
export async function reserveUndercoverWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
  opts: { force?: boolean; runId?: string } = {},
): Promise<UndercoverWordPack | null> {
  z.iso.date().parse(day);
  const maxIndex = opts.force ? Number.MAX_SAFE_INTEGER : UNDERCOVER_DAILY_BATCH_LIMIT - 1;
  z.int().min(0).max(maxIndex).parse(batchIndex);
  const row = await insertReservedWordPack(db, {
    packsTable: 'undercover_word_packs',
    packId: createWordPackId(day, batchIndex, opts),
    categorySql: `SELECT category FROM (SELECT category,
      (SELECT COUNT(*) FROM undercover_word_candidates candidate WHERE candidate.category = category_list.value AND (
        (candidate.status = 'pending' AND (candidate.claimed_pack_id IS NULL OR EXISTS (SELECT 1 FROM undercover_word_packs pack WHERE pack.id = candidate.claimed_pack_id AND pack.status = 'failed')))
        OR (candidate.status = 'approved' AND (candidate.claimed_pack_id IS NULL OR EXISTS (SELECT 1 FROM undercover_word_packs pack WHERE pack.id = candidate.claimed_pack_id AND pack.status = 'failed'))))) AS pending_count,
      (SELECT COUNT(*) FROM undercover_word_pairs pair WHERE pair.category = category_list.value AND pair.status = 'active') AS active_count
    FROM (SELECT value, value AS category FROM json_each(?)) category_list
    ORDER BY active_count ASC,
      CASE WHEN ? = 0 THEN -pending_count ELSE 0 END ASC,
      COALESCE((SELECT MAX(created_at) FROM undercover_word_packs previous WHERE previous.category = category_list.value), '') > ? ASC,
      COALESCE((SELECT MAX(created_at) FROM undercover_word_packs previous WHERE previous.category = category_list.value), '') ASC,
      category ASC LIMIT 1)`,
    categoryBinds: [
      JSON.stringify(UNDERCOVER_CATEGORIES),
      batchIndex % 2,
      wordCategoryCooldownCutoff(),
    ],
    model: UNDERCOVER_WORD_MODEL,
    promptVersion: UNDERCOVER_WORD_PROMPT_VERSION,
    reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
  });
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

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failUndercoverWordPack(
  db: D1Database,
  pack: UndercoverWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'undercover_word_packs', pack, reason);
}
