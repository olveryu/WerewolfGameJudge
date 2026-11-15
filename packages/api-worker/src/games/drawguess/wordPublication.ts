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
import { DRAWGUESS_WORD_PROMPT_VERSION, DRAWGUESS_WORD_REVIEW_VERSION } from './wordEditorial';
import { DRAWGUESS_WORD_MODEL } from './wordProvider';

const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(DRAWGUESS_WORD_CATEGORIES),
  request_token: z.string(),
});
export type DrawGuessWordPack = z.output<typeof packSchema>;

/** Reserve the category with the fewest active words, then the most queued submissions, so supply stays balanced. */
export async function reserveDrawGuessWordPack(
  db: D1Database,
  day: string,
  runId: string,
): Promise<DrawGuessWordPack | null> {
  z.iso.date().parse(day);
  z.string().min(1).max(64).parse(runId);
  const row = await insertReservedWordPack(db, {
    packsTable: 'drawguess_word_packs',
    packId: createWordPackId(day, runId),
    categorySql: `SELECT value AS category
      FROM (SELECT value FROM json_each(?)) c
      ORDER BY (SELECT COUNT(*) FROM drawguess_words w WHERE w.category = c.value AND w.status = 'active') ASC,
        -(SELECT COUNT(*) FROM word_submission_items item WHERE item.game = 'drawguess' AND item.status IN ('pending', 'approved')
          AND json_extract(item.material_json, '$.category') = c.value) ASC,
        COALESCE((SELECT MAX(created_at) FROM drawguess_word_packs previous WHERE previous.category = c.value), '') > ? ASC,
        COALESCE((SELECT MAX(created_at) FROM drawguess_word_packs previous WHERE previous.category = c.value), '') ASC,
        category ASC LIMIT 1`,
    categoryBinds: [JSON.stringify(DRAWGUESS_WORD_CATEGORIES), wordCategoryCooldownCutoff()],
    model: DRAWGUESS_WORD_MODEL,
    promptVersion: DRAWGUESS_WORD_PROMPT_VERSION,
    reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
  });
  return row === null ? null : packSchema.parse(row);
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failDrawGuessWordPack(
  db: D1Database,
  pack: DrawGuessWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'drawguess_word_packs', pack, reason);
}
