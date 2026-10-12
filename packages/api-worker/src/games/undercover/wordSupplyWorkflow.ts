/** Scheduled stock supply; no provider calls from player commands or room startup. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import {
  runWordSupplyWorkflow,
  type WordSupplyParams,
} from '../../platform/wordSupply/wordSupplyWorkflow';
import { parseUndercoverCandidates } from './wordEditorial';
import { createUndercoverWordProvider, UNDERCOVER_WORD_MODEL } from './wordProvider';
import {
  failUndercoverWordPack,
  getUndercoverReviewCandidates,
  publishUndercoverWordPack,
  reserveUndercoverWordPack,
  storeUndercoverWordCandidates,
  UNDERCOVER_DAILY_BATCH_LIMIT,
} from './wordPublication';

const historySchema = z.array(z.strictObject({ wordA: z.string(), wordB: z.string() }));

/** Durable single-day batches with independent review and non-repeatable external operations. */
export class UndercoverWordSupplyWorkflow extends WorkflowEntrypoint<Env, WordSupplyParams> {
  async run(event: WorkflowEvent<WordSupplyParams>, step: WorkflowStep) {
    return runWordSupplyWorkflow(this.env, event.payload, step, {
      gameLabel: 'undercover',
      isEnabled: (env) => env.UNDERCOVER_WORD_SUPPLY_ENABLED === 'true',
      dailyBatchLimit: UNDERCOVER_DAILY_BATCH_LIMIT,
      model: UNDERCOVER_WORD_MODEL,
      packsTable: 'undercover_word_packs',
      loadHistory: async (db, category) => {
        const rows = await db
          .prepare(
            `SELECT word_a AS wordA, word_b AS wordB FROM undercover_word_candidates WHERE category = ? ORDER BY created_at DESC LIMIT 60`,
          )
          .bind(category)
          .all();
        return historySchema.parse(rows.results);
      },
      createProvider: createUndercoverWordProvider,
      parseCandidates: parseUndercoverCandidates,
      publication: {
        reserve: reserveUndercoverWordPack,
        getReviewCandidates: getUndercoverReviewCandidates,
        storeCandidates: storeUndercoverWordCandidates,
        publish: publishUndercoverWordPack,
        fail: failUndercoverWordPack,
      },
    });
  }
}
