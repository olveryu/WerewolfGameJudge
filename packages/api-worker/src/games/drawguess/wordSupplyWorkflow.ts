/** Scheduled DrawGuess word supply; no provider calls from player commands or room startup. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import {
  runWordSupplyWorkflow,
  type WordSupplyParams,
} from '../../platform/wordSupply/wordSupplyWorkflow';
import { parseDrawGuessCandidates } from './wordEditorial';
import { createDrawGuessWordProvider, DRAWGUESS_WORD_MODEL } from './wordProvider';
import {
  DRAWGUESS_DAILY_BATCH_LIMIT,
  failDrawGuessWordPack,
  getDrawGuessReviewCandidates,
  publishDrawGuessWordPack,
  reserveDrawGuessWordPack,
  storeDrawGuessWordCandidates,
} from './wordPublication';

const historySchema = z.array(z.strictObject({ word: z.string() }));

/** Durable single-day batches with independent review and non-repeatable external operations. */
export class DrawGuessWordSupplyWorkflow extends WorkflowEntrypoint<Env, WordSupplyParams> {
  async run(event: WorkflowEvent<WordSupplyParams>, step: WorkflowStep) {
    return runWordSupplyWorkflow(this.env, event.payload, step, {
      gameLabel: 'drawguess',
      isEnabled: (env) => env.DRAWGUESS_WORD_SUPPLY_ENABLED === 'true',
      dailyBatchLimit: DRAWGUESS_DAILY_BATCH_LIMIT,
      model: DRAWGUESS_WORD_MODEL,
      packsTable: 'drawguess_word_packs',
      loadHistory: async (db, category) => {
        const rows = await db
          .prepare(
            `SELECT word FROM drawguess_words WHERE category = ? AND status = 'active' ORDER BY created_at DESC LIMIT 60`,
          )
          .bind(category)
          .all();
        return historySchema.parse(rows.results).map((row) => row.word);
      },
      createProvider: createDrawGuessWordProvider,
      parseCandidates: parseDrawGuessCandidates,
      publication: {
        reserve: reserveDrawGuessWordPack,
        getReviewCandidates: getDrawGuessReviewCandidates,
        storeCandidates: storeDrawGuessWordCandidates,
        publish: publishDrawGuessWordPack,
        fail: failDrawGuessWordPack,
      },
    });
  }
}
