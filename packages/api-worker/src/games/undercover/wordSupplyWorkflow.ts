/** Scheduled stock supply; no provider calls from player commands or room startup. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import { parseUndercoverCandidates } from './wordEditorial';
import { createUndercoverWordProvider, UNDERCOVER_WORD_MODEL } from './wordProvider';
import {
  failUndercoverWordPack,
  getUndercoverReviewCandidates,
  publishUndercoverWordPack,
  reserveUndercoverWordPack,
  storeUndercoverWordCandidates,
  UNDERCOVER_DAILY_BATCH_LIMIT,
  type UndercoverWordPack,
} from './wordPublication';

const MODEL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '130 seconds' } as const;
const log = createLogger('undercover-word-supply');
const historySchema = z.array(z.strictObject({ wordA: z.string(), wordB: z.string() }));
interface UndercoverWordSupplyParams {
  readonly day: string;
}

/** Durable single-day batches with independent review and non-repeatable external operations. */
export class UndercoverWordSupplyWorkflow extends WorkflowEntrypoint<
  Env,
  UndercoverWordSupplyParams
> {
  async run(event: WorkflowEvent<UndercoverWordSupplyParams>, step: WorkflowStep) {
    const day = z.iso.date().parse(event.payload.day);
    if (!(await step.do('enabled', async () => this.env.UNDERCOVER_WORD_SUPPLY_ENABLED === 'true')))
      return { status: 'disabled' };
    if (day !== new Date().toISOString().slice(0, 10)) return { status: 'expired' };
    for (let batchIndex = 0; batchIndex < UNDERCOVER_DAILY_BATCH_LIMIT; batchIndex += 1) {
      const capacity = await step.do(`capacity-${batchIndex}`, () =>
        measureDatabaseCapacity(this.env.DB),
      );
      if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
      const pack = await step.do(`reserve-${batchIndex}`, () =>
        reserveUndercoverWordPack(this.env.DB, day, batchIndex),
      );
      if (pack === null) continue;
      await this.processPack(step, pack, batchIndex);
      await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
    }
    return { status: 'complete' };
  }

  private async processPack(
    step: WorkflowStep,
    pack: UndercoverWordPack,
    batchIndex: number,
  ): Promise<void> {
    let failureStage = 'candidateSelection';
    try {
      let candidates = await step.do(`candidates-${batchIndex}`, () =>
        getUndercoverReviewCandidates(this.env.DB, pack),
      );
      if (candidates.length === 0) {
        const history = await step.do(`history-${batchIndex}`, async () => {
          const rows = await this.env.DB.prepare(
            `SELECT word_a AS wordA, word_b AS wordB FROM undercover_word_candidates WHERE category = ? ORDER BY created_at DESC LIMIT 60`,
          )
            .bind(pack.category)
            .all();
          return historySchema.parse(rows.results);
        });
        failureStage = 'generation';
        const generated = await step.do(`generate-${batchIndex}`, MODEL_STEP, async () => {
          await claimEditorialModelRequest(
            this.env.DB,
            `undercover:${pack.id}:generation`,
            'undercover',
            UNDERCOVER_WORD_MODEL,
          );
          return createUndercoverWordProvider(this.env.GEMINI_API_KEY).generateBatch(
            pack.category,
            history,
          );
        });
        failureStage = 'candidateStorage';
        await step.do(`store-${batchIndex}`, async () => {
          await this.env.DB.prepare(
            `UPDATE undercover_word_packs SET generation_json = ? WHERE id = ? AND request_token = ? AND status = 'reserved'`,
          )
            .bind(JSON.stringify(generated), pack.id, pack.request_token)
            .run();
          await storeUndercoverWordCandidates(
            this.env.DB,
            pack,
            parseUndercoverCandidates(generated, pack.category),
          );
        });
        candidates = await step.do(`generated-candidates-${batchIndex}`, () =>
          getUndercoverReviewCandidates(this.env.DB, pack),
        );
      }
      failureStage = 'review';
      const reviews =
        candidates.length === 0
          ? []
          : await this.reviewCandidates(step, pack, batchIndex, candidates);
      failureStage = 'publication';
      await step.do(`publish-${batchIndex}`, () =>
        publishUndercoverWordPack(this.env.DB, pack, candidates, reviews),
      );
    } catch (error) {
      await step.do(`fail-${batchIndex}`, async () => {
        await failUndercoverWordPack(this.env.DB, pack, failureStage);
        log.error('editorial pack failed', { packId: pack.id, failureStage });
      });
      throw error;
    }
  }

  private async reviewCandidates(
    step: WorkflowStep,
    pack: UndercoverWordPack,
    batchIndex: number,
    candidates: Awaited<ReturnType<typeof getUndercoverReviewCandidates>>,
  ) {
    await step.sleep(`review-spacing-${batchIndex}`, '20 seconds');
    return step.do(`review-${batchIndex}`, MODEL_STEP, async () => {
      await claimEditorialModelRequest(
        this.env.DB,
        `undercover:${pack.id}:review`,
        'undercover',
        UNDERCOVER_WORD_MODEL,
      );
      return createUndercoverWordProvider(this.env.GEMINI_API_KEY).reviewBatch(
        pack.category,
        candidates,
      );
    });
  }
}
