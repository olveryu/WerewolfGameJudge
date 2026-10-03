/** Scheduled DrawGuess word supply; no provider calls from player commands or room startup. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import { parseDrawGuessCandidates } from './wordEditorial';
import { createDrawGuessWordProvider, DRAWGUESS_WORD_MODEL } from './wordProvider';
import {
  DRAWGUESS_DAILY_BATCH_LIMIT,
  failDrawGuessWordPack,
  getDrawGuessReviewCandidates,
  publishDrawGuessWordPack,
  reserveDrawGuessWordPack,
  storeDrawGuessWordCandidates,
  type DrawGuessWordPack,
} from './wordPublication';

const MODEL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '130 seconds' } as const;
const log = createLogger('drawguess-word-supply');
const historySchema = z.array(z.strictObject({ word: z.string() }));
interface DrawGuessWordSupplyParams {
  readonly day: string;
  readonly force?: boolean;
  /** Unique id for admin manual triggers; keeps pack ids collision-free. */
  readonly runId?: string;
}

/** Durable single-day batches with independent review and non-repeatable external operations. */
export class DrawGuessWordSupplyWorkflow extends WorkflowEntrypoint<
  Env,
  DrawGuessWordSupplyParams
> {
  async run(event: WorkflowEvent<DrawGuessWordSupplyParams>, step: WorkflowStep) {
    const day = z.iso.date().parse(event.payload.day);
    if (!(await step.do('enabled', async () => this.env.DRAWGUESS_WORD_SUPPLY_ENABLED === 'true')))
      return { status: 'disabled' };
    if (day !== new Date().toISOString().slice(0, 10)) return { status: 'expired' };
    const force = event.payload.force === true;
    const runId = z.string().min(1).max(64).optional().parse(event.payload.runId);
    // Force mode runs one extra full daily cycle beyond the scheduled limit.
    const totalBatches = DRAWGUESS_DAILY_BATCH_LIMIT + (force ? DRAWGUESS_DAILY_BATCH_LIMIT : 0);
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const capacity = await step.do(`capacity-${batchIndex}`, () =>
        measureDatabaseCapacity(this.env.DB),
      );
      if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
      const pack = await step.do(`reserve-${batchIndex}`, () =>
        reserveDrawGuessWordPack(this.env.DB, day, batchIndex, { force, runId }),
      );
      if (pack === null) continue;
      await this.processPack(step, pack, batchIndex, force);
      await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
    }
    return { status: 'complete' };
  }

  private async processPack(
    step: WorkflowStep,
    pack: DrawGuessWordPack,
    batchIndex: number,
    force: boolean,
  ): Promise<void> {
    let failureStage = 'candidateSelection';
    try {
      let candidates = await step.do(`candidates-${batchIndex}`, () =>
        getDrawGuessReviewCandidates(this.env.DB, pack),
      );
      if (candidates.length === 0) {
        const history = await step.do(`history-${batchIndex}`, async () => {
          const rows = await this.env.DB.prepare(
            `SELECT word FROM drawguess_words WHERE category = ? AND status = 'active' ORDER BY created_at DESC LIMIT 60`,
          )
            .bind(pack.category)
            .all();
          return historySchema.parse(rows.results).map((row) => row.word);
        });
        failureStage = 'generation';
        const generated = await step.do(`generate-${batchIndex}`, MODEL_STEP, async () => {
          await claimEditorialModelRequest(
            this.env.DB,
            `drawguess:${pack.id}:generation`,
            'drawguess',
            DRAWGUESS_WORD_MODEL,
            Date.now(),
            { force },
          );
          return createDrawGuessWordProvider(this.env.GEMINI_API_KEY).generateBatch(
            pack.category,
            history,
          );
        });
        failureStage = 'candidateStorage';
        await step.do(`store-${batchIndex}`, async () => {
          await this.env.DB.prepare(
            `UPDATE drawguess_word_packs SET generation_json = ? WHERE id = ? AND request_token = ? AND status = 'reserved'`,
          )
            .bind(JSON.stringify(generated), pack.id, pack.request_token)
            .run();
          await storeDrawGuessWordCandidates(
            this.env.DB,
            pack,
            parseDrawGuessCandidates(generated, pack.category),
          );
        });
        candidates = await step.do(`generated-candidates-${batchIndex}`, () =>
          getDrawGuessReviewCandidates(this.env.DB, pack),
        );
      }
      failureStage = 'review';
      const reviews =
        candidates.length === 0
          ? []
          : await this.reviewCandidates(step, pack, batchIndex, candidates, force);
      failureStage = 'publication';
      await step.do(`publish-${batchIndex}`, () =>
        publishDrawGuessWordPack(this.env.DB, pack, candidates, reviews),
      );
    } catch (error) {
      await step.do(`fail-${batchIndex}`, async () => {
        await failDrawGuessWordPack(this.env.DB, pack, failureStage);
        log.error('editorial pack failed', { packId: pack.id, failureStage });
      });
      throw error;
    }
  }

  private async reviewCandidates(
    step: WorkflowStep,
    pack: DrawGuessWordPack,
    batchIndex: number,
    candidates: Awaited<ReturnType<typeof getDrawGuessReviewCandidates>>,
    force: boolean,
  ) {
    await step.sleep(`review-spacing-${batchIndex}`, '20 seconds');
    return step.do(`review-${batchIndex}`, MODEL_STEP, async () => {
      await claimEditorialModelRequest(
        this.env.DB,
        `drawguess:${pack.id}:review`,
        'drawguess',
        DRAWGUESS_WORD_MODEL,
        Date.now(),
        { force },
      );
      return createDrawGuessWordProvider(this.env.GEMINI_API_KEY).reviewBatch(
        pack.category,
        candidates,
      );
    });
  }
}
