/** Scheduled DrawGuess word supply; no provider calls from player commands or room startup. */
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { storeSupplySubmissions } from '../../features/wordSubmissions/ingestion';
import {
  runWordSupplyWorkflow,
  type WordSupplyParams,
} from '../../platform/wordSupply/wordSupplyWorkflow';
import { parseDrawGuessCandidates } from './wordEditorial';
import { createDrawGuessWordProvider, DRAWGUESS_WORD_MODEL } from './wordProvider';
import { failDrawGuessWordPack, reserveDrawGuessWordPack } from './wordPublication';

const historySchema = z.array(z.strictObject({ word: z.string() }));
/**
 * Generation history is the inventory words of the category, including
 * disabled ones: word identity is unique, so listing only active words
 * made the model re-propose words that storage then discarded. The bound
 * keeps the request size independent of inventory growth.
 */
const GENERATION_HISTORY_LIMIT = 400;

/** Durable single-day generation batches; review and publication are manual. */
export class DrawGuessWordSupplyWorkflow extends WorkflowEntrypoint<Env, WordSupplyParams> {
  async run(event: WorkflowEvent<WordSupplyParams>, step: WorkflowStep) {
    return runWordSupplyWorkflow(this.env, event.payload, step, {
      game: 'drawguess',
      gameLabel: 'drawguess',
      isEnabled: (env) => env.DRAWGUESS_WORD_SUPPLY_ENABLED === 'true',
      model: DRAWGUESS_WORD_MODEL,
      categorySchema: z.enum(DRAWGUESS_WORD_CATEGORY_CATALOG.ids),
      packsTable: 'drawguess_word_packs',
      loadHistory: async (db, category) => {
        // History is the inventory words: the candidate table is dropped
        // (0085), so rejected/unpublished history no longer exists to
        // consult. Regenerated duplicates are still caught by the
        // ingestion dedup, not by history.
        const rows = await db
          .prepare(
            `SELECT word FROM drawguess_words WHERE category = ?1
             ORDER BY created_at DESC, word LIMIT ?2`,
          )
          .bind(category, GENERATION_HISTORY_LIMIT)
          .all();
        return historySchema.parse(rows.results).map((row) => row.word);
      },
      createProvider: createDrawGuessWordProvider,
      parseCandidates: parseDrawGuessCandidates,
      toSubmissionItems: (pack, candidates) =>
        candidates.map((candidate, index) => ({
          clientItemId: `${pack.id}:${index}`,
          content: { ...candidate },
        })),
      // The shared runner must not import the submission ingestion (it
      // reaches the game catalog): the game supplies the store step.
      storeSubmissions: async (db, batchId, items) => {
        const batch = await storeSupplySubmissions(db, 'drawguess', batchId, items);
        return batch.items.length;
      },
      publication: {
        reserve: reserveDrawGuessWordPack,
        fail: failDrawGuessWordPack,
      },
    });
  }
}
