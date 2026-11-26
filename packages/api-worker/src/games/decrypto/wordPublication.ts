/** Reserve and fail one Decrypto word-supply batch. */
import {
  DECRYPTO_WORD_CATEGORIES,
  type DecryptoWordCategory,
} from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import {
  createWordPackId,
  failWordPack,
  insertReservedWordPack,
} from '../../platform/wordSupply/wordPackLedger';
import { DECRYPTO_WORD_PROMPT_VERSION, DECRYPTO_WORD_REVIEW_VERSION } from './wordEditorial';
import { DECRYPTO_WORD_MODEL } from './wordProvider';

const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(DECRYPTO_WORD_CATEGORIES),
  request_token: z.string(),
});
export type DecryptoWordPack = z.output<typeof packSchema>;

export async function reserveDecryptoWordPack(
  db: D1Database,
  day: string,
  runId: string,
  category: DecryptoWordCategory,
): Promise<DecryptoWordPack | null> {
  z.iso.date().parse(day);
  z.string().min(1).max(64).parse(runId);
  const selectedCategory = z.enum(DECRYPTO_WORD_CATEGORIES).parse(category);
  const row = await insertReservedWordPack(db, {
    packsTable: 'decrypto_word_packs',
    packId: createWordPackId(day, runId),
    categorySql: 'SELECT ?',
    categoryBinds: [selectedCategory],
    model: DECRYPTO_WORD_MODEL,
    promptVersion: DECRYPTO_WORD_PROMPT_VERSION,
    reviewVersion: DECRYPTO_WORD_REVIEW_VERSION,
  });
  return row === null ? null : packSchema.parse(row);
}

export async function failDecryptoWordPack(
  db: D1Database,
  pack: DecryptoWordPack,
  reason: string,
): Promise<void> {
  await failWordPack(db, 'decrypto_word_packs', pack, reason);
}
