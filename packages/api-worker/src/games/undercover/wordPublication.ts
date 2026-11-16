/**
 * Transactional editorial queue; pair identity survives reviews and
 * retirement. Supply only generates and stores — review and publication
 * live on the manual review/publish endpoints, never in the workflow.
 */
import {
  UNDERCOVER_CATEGORIES,
  type UndercoverCategory,
} from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import {
  createWordPackId,
  failWordPack,
  insertReservedWordPack,
} from '../../platform/wordSupply/wordPackLedger';
import { UNDERCOVER_WORD_PROMPT_VERSION, UNDERCOVER_WORD_REVIEW_VERSION } from './wordEditorial';
import { UNDERCOVER_WORD_MODEL } from './wordProvider';

const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(UNDERCOVER_CATEGORIES),
  request_token: z.string(),
});
export type UndercoverWordPack = z.output<typeof packSchema>;

/** Alternate between the queued (pending/approved) submissions and the smallest active inventory. */
export async function reserveUndercoverWordPack(
  db: D1Database,
  day: string,
  runId: string,
  category: UndercoverCategory,
): Promise<UndercoverWordPack | null> {
  z.iso.date().parse(day);
  z.string().min(1).max(64).parse(runId);
  const selectedCategory = z.enum(UNDERCOVER_CATEGORIES).parse(category);
  const row = await insertReservedWordPack(db, {
    packsTable: 'undercover_word_packs',
    packId: createWordPackId(day, runId),
    categorySql: 'SELECT ?',
    categoryBinds: [selectedCategory],
    model: UNDERCOVER_WORD_MODEL,
    promptVersion: UNDERCOVER_WORD_PROMPT_VERSION,
    reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
  });
  return row === null ? null : packSchema.parse(row);
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failUndercoverWordPack(
  db: D1Database,
  pack: UndercoverWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'undercover_word_packs', pack, reason);
}
