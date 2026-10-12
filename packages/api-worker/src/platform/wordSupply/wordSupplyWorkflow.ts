/**
 * Shared word-supply workflow runtime for the twin editorial queues (AU-40).
 *
 * Undercover and drawguess run the same durable batch choreography — enable
 * gate, capacity check, reserve, generate from history when the queue is
 * empty, review, publish, fail with the stage recorded — and differ only in
 * the config below: env flag, batch limit, model, history shape, provider,
 * candidate parser, and the game's publication functions. The workflow
 * classes and their wrangler bindings stay in each game module; only this
 * runtime is shared. Step names are part of the durable checkpoint format
 * and must not change.
 */
import type { WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { claimEditorialModelRequest } from '../ai/editorialBudget';
import { createLogger } from '../observability/logger';
import { measureDatabaseCapacity } from '../storage/capacity';
import type { WordPackRef, WordPacksTable } from './wordPackLedger';

const MODEL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '130 seconds' } as const;

export interface WordSupplyParams {
  readonly day: string;
  readonly force?: boolean;
  /** Unique id for admin manual triggers; keeps pack ids collision-free. */
  readonly runId?: string;
}

export interface WordSupplyPublication<TPack, TCandidate, TReview> {
  readonly reserve: (
    db: D1Database,
    day: string,
    batchIndex: number,
    opts: { force?: boolean; runId?: string },
  ) => Promise<TPack | null>;
  readonly getReviewCandidates: (db: D1Database, pack: TPack) => Promise<TCandidate[]>;
  readonly storeCandidates: (
    db: D1Database,
    pack: TPack,
    candidates: readonly TCandidate[],
  ) => Promise<void>;
  readonly publish: (
    db: D1Database,
    pack: TPack,
    candidates: readonly TCandidate[],
    reviews: readonly TReview[],
  ) => Promise<void>;
  readonly fail: (db: D1Database, pack: TPack, reason: string) => Promise<void>;
}

export interface WordSupplyProvider<TCategory, TCandidate, TReview, TGenerated, THistory> {
  readonly generateBatch: (category: TCategory, history: THistory) => Promise<TGenerated>;
  readonly reviewBatch: (
    category: TCategory,
    candidates: readonly TCandidate[],
  ) => Promise<readonly TReview[]>;
}

export interface WordSupplyConfig<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TReview extends Rpc.Serializable<TReview>,
  TGenerated extends Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
> {
  readonly gameLabel: string;
  readonly isEnabled: (env: Env) => boolean;
  readonly dailyBatchLimit: number;
  readonly model: string;
  readonly packsTable: WordPacksTable;
  readonly loadHistory: (db: D1Database, category: TCategory) => Promise<THistory>;
  readonly createProvider: (
    apiKey: string,
  ) => WordSupplyProvider<TCategory, TCandidate, TReview, TGenerated, THistory>;
  readonly parseCandidates: (generated: TGenerated, category: TCategory) => readonly TCandidate[];
  readonly publication: WordSupplyPublication<TPack, TCandidate, TReview>;
}

/** Run one day of batches; force mode runs one extra full daily cycle beyond the limit. */
export async function runWordSupplyWorkflow<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TReview extends Rpc.Serializable<TReview>,
  TGenerated extends Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
>(
  env: Env,
  payload: WordSupplyParams,
  step: WorkflowStep,
  config: WordSupplyConfig<TCategory, TPack, TCandidate, TReview, TGenerated, THistory>,
) {
  const day = z.iso.date().parse(payload.day);
  if (!(await step.do('enabled', async () => config.isEnabled(env)))) return { status: 'disabled' };
  if (day !== new Date().toISOString().slice(0, 10)) return { status: 'expired' };
  const force = payload.force === true;
  const runId = z.string().min(1).max(64).optional().parse(payload.runId);
  const totalBatches = config.dailyBatchLimit + (force ? config.dailyBatchLimit : 0);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const capacity = await step.do(`capacity-${batchIndex}`, () => measureDatabaseCapacity(env.DB));
    if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
    const pack = await step.do(`reserve-${batchIndex}`, () =>
      config.publication.reserve(env.DB, day, batchIndex, { force, runId }),
    );
    if (pack === null) continue;
    await processPack(env, step, config, pack, batchIndex, force);
    await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
  }
  return { status: 'complete' };
}

async function processPack<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TReview extends Rpc.Serializable<TReview>,
  TGenerated extends Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
>(
  env: Env,
  step: WorkflowStep,
  config: WordSupplyConfig<TCategory, TPack, TCandidate, TReview, TGenerated, THistory>,
  pack: TPack,
  batchIndex: number,
  force: boolean,
): Promise<void> {
  const log = createLogger(`${config.gameLabel}-word-supply`);
  let failureStage = 'candidateSelection';
  try {
    let candidates = await step.do(`candidates-${batchIndex}`, () =>
      config.publication.getReviewCandidates(env.DB, pack),
    );
    if (candidates.length === 0) {
      const history = await step.do(`history-${batchIndex}`, () =>
        config.loadHistory(env.DB, pack.category),
      );
      failureStage = 'generation';
      const generated = await step.do(`generate-${batchIndex}`, MODEL_STEP, async () => {
        await claimEditorialModelRequest(
          env.DB,
          `${config.gameLabel}:${pack.id}:generation`,
          config.gameLabel,
          config.model,
          Date.now(),
          { force },
        );
        return config.createProvider(env.GEMINI_API_KEY).generateBatch(pack.category, history);
      });
      failureStage = 'candidateStorage';
      await step.do(`store-${batchIndex}`, async () => {
        await env.DB.prepare(
          `UPDATE ${config.packsTable} SET generation_json = ? WHERE id = ? AND request_token = ? AND status = 'reserved'`,
        )
          .bind(JSON.stringify(generated), pack.id, pack.request_token)
          .run();
        await config.publication.storeCandidates(
          env.DB,
          pack,
          config.parseCandidates(generated, pack.category),
        );
      });
      candidates = await step.do(`generated-candidates-${batchIndex}`, () =>
        config.publication.getReviewCandidates(env.DB, pack),
      );
    }
    failureStage = 'review';
    const reviews =
      candidates.length === 0
        ? []
        : await reviewCandidates(env, step, config, pack, batchIndex, candidates, force);
    failureStage = 'publication';
    await step.do(`publish-${batchIndex}`, () =>
      config.publication.publish(env.DB, pack, candidates, reviews),
    );
  } catch (error) {
    await step.do(`fail-${batchIndex}`, async () => {
      await config.publication.fail(env.DB, pack, failureStage);
      log.error('editorial pack failed', { packId: pack.id, failureStage });
    });
    throw error;
  }
}

async function reviewCandidates<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TReview extends Rpc.Serializable<TReview>,
  TGenerated extends Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
>(
  env: Env,
  step: WorkflowStep,
  config: WordSupplyConfig<TCategory, TPack, TCandidate, TReview, TGenerated, THistory>,
  pack: TPack,
  batchIndex: number,
  candidates: TCandidate[],
  force: boolean,
) {
  await step.sleep(`review-spacing-${batchIndex}`, '20 seconds');
  return step.do(`review-${batchIndex}`, MODEL_STEP, async () => {
    await claimEditorialModelRequest(
      env.DB,
      `${config.gameLabel}:${pack.id}:review`,
      config.gameLabel,
      config.model,
      Date.now(),
      { force },
    );
    return config.createProvider(env.GEMINI_API_KEY).reviewBatch(pack.category, candidates);
  });
}
