/** Scheduled Decrypto word supply; generation creates pending submissions only. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { storeSupplySubmissions } from '../../features/wordSubmissions/ingestion';
import {
  runWordSupplyWorkflow,
  type WordSupplyParams,
} from '../../platform/wordSupply/wordSupplyWorkflow';
import { DECRYPTO_WORD_CATEGORIES } from './wordCategories';
import { parseDecryptoCandidates } from './wordEditorial';
import { createDecryptoWordProvider, DECRYPTO_WORD_MODEL } from './wordProvider';
import { failDecryptoWordPack, reserveDecryptoWordPack } from './wordPublication';

const historySchema = z.array(z.strictObject({ word: z.string() }));
const GENERATION_HISTORY_LIMIT = 400;

/** Durable single-run generation; human review and publication remain separate. */
export class DecryptoWordSupplyWorkflow extends WorkflowEntrypoint<Env, WordSupplyParams> {
  async run(event: WorkflowEvent<WordSupplyParams>, step: WorkflowStep) {
    return runWordSupplyWorkflow(this.env, event.payload, step, {
      game: 'decrypto',
      gameLabel: 'decrypto',
      isEnabled: (env) => env.DECRYPTO_WORD_SUPPLY_ENABLED === 'true',
      model: DECRYPTO_WORD_MODEL,
      categorySchema: z.enum(DECRYPTO_WORD_CATEGORIES),
      packsTable: 'decrypto_word_packs',
      loadHistory: async (db, category) => {
        const rows = await db
          .prepare(
            `SELECT word FROM decrypto_words WHERE category = ?
             ORDER BY created_at DESC, word LIMIT ?`,
          )
          .bind(category, GENERATION_HISTORY_LIMIT)
          .all();
        return historySchema.parse(rows.results).map(({ word }) => word);
      },
      createProvider: createDecryptoWordProvider,
      parseCandidates: parseDecryptoCandidates,
      toSubmissionItems: (pack, candidates) =>
        candidates.map((candidate, index) => ({
          clientItemId: `${pack.id}:${index}`,
          content: { ...candidate },
        })),
      storeSubmissions: async (db, batchId, items) => {
        const batch = await storeSupplySubmissions(db, 'decrypto', batchId, items);
        return batch.items.length;
      },
      publication: {
        reserve: reserveDecryptoWordPack,
        fail: failDecryptoWordPack,
      },
    });
  }
}
