/**
 * Shared word-supply workflow runtime for the twin editorial queues (AU-40).
 *
 * Undercover and drawguess run the same durable batch choreography — enable
 * gate, capacity check, reserve, generate from history, store, fail with
 * the stage recorded — and differ only in the config below: env flag, model,
 * history shape, provider, candidate parser, and the game's publication
 * functions. The workflow classes and their wrangler bindings stay in each
 * game module; only this runtime is shared. Step names are part of the
 * durable checkpoint format and must not change.
 *
 * Supply only generates: one trigger runs one pack and stores its generated
 * candidates as pending submission items under the system agent (one batch
 * per run, id = run id), then stops. Review and publication are manual,
 * through the submission flow — there is no other road from generation to
 * the inventory. There is no daily batch limit: the admin controls how
 * often to trigger by hand.
 */
import type { GameWordGame } from '@game-judge/game-engine/product/wordSupply';
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
import { claimEditorialModelRequest } from '../ai/editorialBudget';
import { createLogger } from '../observability/logger';
import { measureDatabaseCapacity } from '../storage/capacity';
import type { WordSupplySubmissionItem } from './submissionAdapter';
import type { WordPackRef, WordPacksTable } from './wordPackLedger';

const MODEL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '130 seconds' } as const;

export interface WordSupplyParams {
  readonly day: string;
  /** Unique id for admin manual triggers (a UUID); keeps pack ids collision-free. */
  readonly runId: string;
  readonly category: string;
}

/**
 * The two pieces the generate-only runner needs from a game: reserve a
 * pack and mark it failed. Storage is game-supplied too (see
 * WordSupplyConfig.storeSubmissions): the shared runner must not import the
 * submission ingestion, which reaches the game catalog through the
 * submission adapters. Generated candidates are stored as submission items,
 * never as candidates.
 */
export interface WordSupplyPublication<TCategory, TPack> {
  readonly reserve: (
    db: D1Database,
    day: string,
    runId: string,
    category: TCategory,
  ) => Promise<TPack | null>;
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
  readonly game: GameWordGame;
  readonly gameLabel: string;
  readonly isEnabled: (env: Env) => boolean;
  readonly model: string;
  readonly categorySchema: z.ZodType<TCategory>;
  readonly packsTable: WordPacksTable;
  readonly loadHistory: (db: D1Database, category: TCategory) => Promise<THistory>;
  readonly createProvider: (apiKey: string) => WordSupplyProvider<TCategory, TGenerated, THistory>;
  readonly parseCandidates: (
    generated: { readonly candidates: readonly TCandidate[] },
    category: TCategory,
  ) => readonly TCandidate[];
  /** Map generated candidates to submission items; clientItemId is unique per pack. */
  readonly toSubmissionItems: (
    pack: TPack,
    candidates: readonly TCandidate[],
  ) => readonly WordSupplySubmissionItem[];
  /**
   * Store generated candidates as pending submissions. Supplied by the game
   * (it calls the submission ingestion) so the shared runner never imports
   * the ingestion itself. Returns the stored item count.
   */
  readonly storeSubmissions: (
    db: D1Database,
    batchId: string,
    items: readonly WordSupplySubmissionItem[],
  ) => Promise<number>;
  readonly publication: WordSupplyPublication<TCategory, TPack>;
}

/** One trigger runs one pack and stores its generated candidates. */
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
  const category = config.categorySchema.parse(payload.category);
  if (!(await step.do('enabled', async () => config.isEnabled(env)))) return { status: 'disabled' };
  if (day !== new Date().toISOString().slice(0, 10)) return { status: 'expired' };
  // The batch id is the run's UUID: the submission batch header schema
  // requires a UUID, so the workflow instance id (`<game>-manual-<uuid>`)
  // cannot serve as the batch id.
  const batchId = z.uuid().parse(payload.runId);
  const capacity = await step.do('capacity', () => measureDatabaseCapacity(env.DB));
  if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
  const pack = await step.do('reserve', () =>
    config.publication.reserve(env.DB, day, batchId, category),
  );
  if (pack === null) return { status: 'complete', stored: 0 };
  const stored = await processPack(env, step, config, pack, batchId);
  return { status: 'complete', stored };
}

/**
 * Process the run's one pack: generate new candidates and store them as
 * pending submission items, then stop. Returns the number of items stored.
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
  batchId: string,
): Promise<number> {
  const log = createLogger(`${config.gameLabel}-word-supply`);
  let failureStage = 'candidateSelection';
  try {
    const history = await step.do('history', () => config.loadHistory(env.DB, pack.category));
    failureStage = 'generation';
    const generated = await step.do('generate', MODEL_STEP, async () => {
      await claimEditorialModelRequest(
        env.DB,
        `${config.gameLabel}:${pack.id}:generation`,
        config.gameLabel,
        config.model,
        'generation',
        Date.now(),
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
    const stored = await step.do('store', async () => {
      await env.DB.prepare(
        `UPDATE ${config.packsTable} SET generation_json = ? WHERE id = ? AND request_token = ? AND status = 'reserved'`,
      )
        .bind(JSON.stringify(material), pack.id, pack.request_token)
        .run();
      return config.storeSubmissions(
        env.DB,
        batchId,
        config.toSubmissionItems(pack, parsedCandidates),
      );
    });
    // Newly stored items are pending submissions until a human endorses
    // and reviews them: stop here, leave the pack reserved, and run no
    // review or publish for it. (A zero-candidate store cannot happen —
    // generation throws allCandidatesRejected on zero valid candidates —
    // but if it ever did, the pack stays reserved like any other gated
    // pack, with nothing to review.)
    return stored;
  } catch (error) {
    await step.do('fail', async () => {
      await config.publication.fail(env.DB, pack, failureStage);
      const context = { packId: pack.id, failureStage };
      if (getAiDiagnostic(error) !== undefined) log.warn('editorial pack failed', context);
      else log.error('editorial pack failed', context);
    });
    throw error;
  }
}
