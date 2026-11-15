/**
 * Transactional editorial queue; word identity survives reviews and
 * retirement. Supply only generates and stores — review and publication
 * live on the manual review/publish endpoints, never in the workflow.
 */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import { wordCategoryCooldownCutoff } from '../../platform/wordSupply/categoryCooldown';
import {
  createWordPackId,
  failWordPack,
  insertReservedWordPack,
} from '../../platform/wordSupply/wordPackLedger';
import {
  DRAWGUESS_WORD_PROMPT_VERSION,
  DRAWGUESS_WORD_REVIEW_VERSION,
  type DrawGuessWordCandidate,
  getDrawGuessWordId,
  parseDrawGuessCandidates,
} from './wordEditorial';
import { DRAWGUESS_WORD_MODEL } from './wordProvider';

export const DRAWGUESS_DAILY_BATCH_LIMIT = 2;
const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(DRAWGUESS_WORD_CATEGORIES),
  request_token: z.string(),
});
export type DrawGuessWordPack = z.output<typeof packSchema>;

/** Reserve the category with the fewest active words, so supply stays balanced. */
export async function reserveDrawGuessWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
  opts: { force?: boolean; runId?: string } = {},
): Promise<DrawGuessWordPack | null> {
  z.iso.date().parse(day);
  const maxIndex = opts.force ? Number.MAX_SAFE_INTEGER : DRAWGUESS_DAILY_BATCH_LIMIT - 1;
  z.int().min(0).max(maxIndex).parse(batchIndex);
  const row = await insertReservedWordPack(db, {
    packsTable: 'drawguess_word_packs',
    packId: createWordPackId(day, batchIndex, opts),
    categorySql: `SELECT value AS category
      FROM (SELECT value FROM json_each(?)) c
      ORDER BY (SELECT COUNT(*) FROM drawguess_words w WHERE w.category = c.value AND w.status = 'active') ASC,
        CASE WHEN ? = 0 THEN -(SELECT COUNT(*) FROM drawguess_word_candidates candidate WHERE candidate.category = c.value AND (
          (candidate.status = 'pending' AND (candidate.claimed_pack_id IS NULL OR EXISTS (SELECT 1 FROM drawguess_word_packs pack WHERE pack.id = candidate.claimed_pack_id AND pack.status = 'failed')))
          OR (candidate.status = 'approved' AND (candidate.claimed_pack_id IS NULL OR EXISTS (SELECT 1 FROM drawguess_word_packs pack WHERE pack.id = candidate.claimed_pack_id AND pack.status = 'failed'))))) ELSE 0 END ASC,
        COALESCE((SELECT MAX(created_at) FROM drawguess_word_packs previous WHERE previous.category = c.value), '') > ? ASC,
        COALESCE((SELECT MAX(created_at) FROM drawguess_word_packs previous WHERE previous.category = c.value), '') ASC,
        category ASC LIMIT 1`,
    categoryBinds: [
      JSON.stringify(DRAWGUESS_WORD_CATEGORIES),
      batchIndex % 2,
      wordCategoryCooldownCutoff(),
    ],
    model: DRAWGUESS_WORD_MODEL,
    promptVersion: DRAWGUESS_WORD_PROMPT_VERSION,
    reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
  });
  return row === null ? null : packSchema.parse(row);
}

/** Persist validated generated material without duplicating any previously reviewed identity. */
export async function storeDrawGuessWordCandidates(
  db: D1Database,
  pack: DrawGuessWordPack,
  candidates: readonly DrawGuessWordCandidate[],
): Promise<void> {
  const parsed = parseDrawGuessCandidates({ candidates }, pack.category);
  const statements: D1PreparedStatement[] = [];
  for (const candidate of parsed) {
    statements.push(
      db
        .prepare(
          `INSERT INTO drawguess_word_candidates (id, word, category, difficulty, material_json, status, created_at)
      SELECT ?, ?, ?, ?, ?, 'pending', ? FROM drawguess_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
      ON CONFLICT (id) DO NOTHING`,
        )
        .bind(
          await getDrawGuessWordId(candidate.word),
          candidate.word,
          candidate.category,
          candidate.difficulty,
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
export async function failDrawGuessWordPack(
  db: D1Database,
  pack: DrawGuessWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'drawguess_word_packs', pack, reason);
}
