/**
 * Shared word-supply workflow runtime for the twin editorial queues (AU-40).
 *
 * Undercover and drawguess run the same durable batch choreography — enable
 * gate, capacity check, reserve, generate from history, store, fail with
 * the stage recorded — and differ only in the config below: env flag, batch
 * limit, model, history shape, provider, candidate parser, and the game's
 * publication functions. The workflow classes and their wrangler bindings
 * stay in each game module; only this runtime is shared. Step names are
 * part of the durable checkpoint format and must not change.
 *
 * Supply only generates: newly stored candidates stop at the approval gate
 * (the run ends with outcome 'awaitingApproval'). Approved candidates are
 * reviewed and published only through the manual review/publish endpoints,
 * never by this workflow — there is no other road from approval to the
 * inventory.
 */
import type { WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import {
  type AiCorrelation,
  AiProviderError,
  getAiDiagnostic,
  parseAiOutput,
  reportAiFailure,
} from '../ai/aiError';
import { claimEditorialModelRequest, isEditorialBudgetAvailable } from '../ai/editorialBudget';
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

/**
 * The three pieces the generate-only runner needs from a game: reserve a
 * pack, store generated candidates into it, and mark it failed. Review and
 * publication live on the manual review/publish endpoints, not here.
 */
export interface WordSupplyPublication<TPack, TCandidate> {
  readonly reserve: (
    db: D1Database,
    day: string,
    batchIndex: number,
    opts: { force?: boolean; runId?: string },
  ) => Promise<TPack | null>;
  readonly storeCandidates: (
    db: D1Database,
    pack: TPack,
    candidates: readonly TCandidate[],
  ) => Promise<void>;
  readonly fail: (db: D1Database, pack: TPack, reason: string) => Promise<void>;
}

export interface WordSupplyProvider<TCategory, TGenerated, THistory> {
  readonly generateBatch: (
    category: TCategory,
    history: THistory,
    context?: AiCorrelation,
  ) => Promise<TGenerated>;
}

export interface WordSupplyConfig<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TGenerated extends { readonly candidates: readonly TCandidate[] } & Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
> {
  readonly gameLabel: string;
  readonly isEnabled: (env: Env) => boolean;
  readonly dailyBatchLimit: number;
  readonly model: string;
  readonly packsTable: WordPacksTable;
  readonly loadHistory: (db: D1Database, category: TCategory) => Promise<THistory>;
  readonly createProvider: (apiKey: string) => WordSupplyProvider<TCategory, TGenerated, THistory>;
  readonly parseCandidates: (
    generated: { readonly candidates: readonly TCandidate[] },
    category: TCategory,
  ) => readonly TCandidate[];
  readonly publication: WordSupplyPublication<TPack, TCandidate>;
}

/** Run one day of batches; force mode runs one extra full daily cycle beyond the limit. */
export async function runWordSupplyWorkflow<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TGenerated extends { readonly candidates: readonly TCandidate[] } & Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
>(
  env: Env,
  payload: WordSupplyParams,
  step: WorkflowStep,
  config: WordSupplyConfig<TCategory, TPack, TCandidate, TGenerated, THistory>,
) {
  const day = z.iso.date().parse(payload.day);
  if (!(await step.do('enabled', async () => config.isEnabled(env)))) return { status: 'disabled' };
  if (day !== new Date().toISOString().slice(0, 10)) return { status: 'expired' };
  const force = payload.force === true;
  const runId = z.string().min(1).max(64).optional().parse(payload.runId);
  const totalBatches = config.dailyBatchLimit + (force ? config.dailyBatchLimit : 0);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    if (
      !force &&
      !(await step.do(`budget-${batchIndex}`, () => isEditorialBudgetAvailable(env.DB)))
    )
      return { status: 'budget_exhausted' };
    const capacity = await step.do(`capacity-${batchIndex}`, () => measureDatabaseCapacity(env.DB));
    if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
    const pack = await step.do(`reserve-${batchIndex}`, () =>
      config.publication.reserve(env.DB, day, batchIndex, { force, runId }),
    );
    if (pack === null) continue;
    if (await processPack(env, step, config, pack, batchIndex, force))
      return { status: 'awaitingApproval' };
    await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
  }
  return { status: 'complete' };
}

/**
 * Process one pack: generate new candidates and store them, then stop at
 * the approval gate. Returns true when the batch stored new candidates
 * (the run ends with outcome 'awaitingApproval' instead of reviewing or
 * publishing them); false when nothing was generated and the run may
 * continue with the next batch.
 */
async function processPack<
  TCategory extends string,
  TPack extends (WordPackRef & { readonly category: TCategory }) & Rpc.Serializable<TPack>,
  TCandidate extends Rpc.Serializable<TCandidate>,
  TGenerated extends { readonly candidates: readonly TCandidate[] } & Rpc.Serializable<TGenerated>,
  THistory extends Rpc.Serializable<THistory>,
>(
  env: Env,
  step: WorkflowStep,
  config: WordSupplyConfig<TCategory, TPack, TCandidate, TGenerated, THistory>,
  pack: TPack,
  batchIndex: number,
  force: boolean,
): Promise<boolean> {
  const log = createLogger(`${config.gameLabel}-word-supply`);
  let failureStage = 'candidateSelection';
  try {
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
        'generation',
        Date.now(),
        { force },
      );
      return config.createProvider(env.GEMINI_API_KEY).generateBatch(pack.category, history, {
        packId: pack.id,
      });
    });
    failureStage = 'candidateStorage';
    const material = { candidates: generated.candidates };
    // Parse outside the store step (like fib): the gate below reads the
    // count that actually gets stored. generated.candidates is already the
    // validated list, so the two counts agree today — but the store step's
    // input is parsedCandidates, and gating on it stays correct if a
    // game's second parse ever filters further.
    let parsedCandidates: readonly TCandidate[];
    try {
      parsedCandidates = parseAiOutput(
        {
          game: config.gameLabel,
          model: config.model,
          operation: 'generate',
          packId: pack.id,
        },
        'outputValidation',
        () => config.parseCandidates(material, pack.category),
      );
    } catch (error) {
      if (error instanceof AiProviderError) reportAiFailure(error);
      throw error;
    }
    await step.do(`store-${batchIndex}`, async () => {
      await env.DB.prepare(
        `UPDATE ${config.packsTable} SET generation_json = ? WHERE id = ? AND request_token = ? AND status = 'reserved'`,
      )
        .bind(JSON.stringify(material), pack.id, pack.request_token)
        .run();
      await config.publication.storeCandidates(env.DB, pack, parsedCandidates);
    });
    // Newly stored candidates are pending until a human approves them:
    // stop this batch — and the run — here, leave the pack reserved, and
    // run no review or publish for it. (A zero-candidate store cannot
    // happen — generation throws allCandidatesRejected on zero valid
    // candidates — but if it ever did, the pack stays reserved like any
    // other gated pack, with nothing to approve.)
    return parsedCandidates.length > 0;
  } catch (error) {
    await step.do(`fail-${batchIndex}`, async () => {
      await config.publication.fail(env.DB, pack, failureStage);
      const context = { packId: pack.id, failureStage };
      if (getAiDiagnostic(error) !== undefined) log.warn('editorial pack failed', context);
      else log.error('editorial pack failed', context);
    });
    throw error;
  }
}
