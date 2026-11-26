/** Scheduled stock supply; no provider calls from player commands or room startup. */
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/undercover/public';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { storeSupplySubmissions } from '../../features/wordSubmissions/ingestion';
import {
  runWordSupplyWorkflow,
  type WordSupplyParams,
} from '../../platform/wordSupply/wordSupplyWorkflow';
import { parseUndercoverCandidates } from './wordEditorial';
import { createUndercoverWordProvider, UNDERCOVER_WORD_MODEL } from './wordProvider';
import { failUndercoverWordPack, reserveUndercoverWordPack } from './wordPublication';

const historySchema = z.array(z.strictObject({ wordA: z.string(), wordB: z.string() }));

/** Durable single-day generation batches; review and publication are manual. */
export class UndercoverWordSupplyWorkflow extends WorkflowEntrypoint<Env, WordSupplyParams> {
  async run(event: WorkflowEvent<WordSupplyParams>, step: WorkflowStep) {
    return runWordSupplyWorkflow(this.env, event.payload, step, {
      game: 'undercover',
      gameLabel: 'undercover',
      isEnabled: (env) => env.UNDERCOVER_WORD_SUPPLY_ENABLED === 'true',
      model: UNDERCOVER_WORD_MODEL,
      categorySchema: z.enum(UNDERCOVER_WORD_CATEGORY_CATALOG.ids),
      packsTable: 'undercover_word_packs',
      loadHistory: async (db, category) => {
        // History is the published pairs: the candidate tables are dropped
        // (0085), so there is no separate generated-but-unpublished history
        // to consult. Regenerated duplicates are still caught by the
        // ingestion dedup, not by history.
        const rows = await db
          .prepare(
            `SELECT word_a AS wordA, word_b AS wordB FROM undercover_word_pairs WHERE category = ? ORDER BY created_at DESC LIMIT 60`,
          )
          .bind(category)
          .all();
        return historySchema.parse(rows.results);
      },
      createProvider: createUndercoverWordProvider,
      parseCandidates: parseUndercoverCandidates,
      toSubmissionItems: (pack, candidates) =>
        candidates.map((candidate, index) => ({
          clientItemId: `${pack.id}:${index}`,
          content: { ...candidate },
        })),
      // The shared runner must not import the submission ingestion (it
      // reaches the game catalog): the game supplies the store step.
      storeSubmissions: async (db, batchId, items) => {
        const batch = await storeSupplySubmissions(db, 'undercover', batchId, items);
        return batch.items.length;
      },
      publication: {
        reserve: reserveUndercoverWordPack,
        fail: failUndercoverWordPack,
      },
    });
  }
}
