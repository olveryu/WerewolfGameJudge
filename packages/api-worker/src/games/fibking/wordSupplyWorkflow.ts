/** Free-tier editorial workflow: separately bounded search, generation, and
 * storage. Review and publication are manual — the workflow only generates
 * new candidates and stops at the approval gate. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { getAiDiagnostic, outputValidationSummarySchema } from '../../platform/ai/aiError';
import {
  claimEditorialModelRequest,
  isEditorialBudgetAvailable,
} from '../../platform/ai/editorialBudget';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import { cleanupFibWordAudit } from './maintenance';
import { createConfiguredFibWordProvider } from './wordProviders';
import { parseFibWordEditorialCandidate } from './wordProviders/candidate';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { getFibWordProviderFailureKind } from './wordProviders/providerError';
import {
  extractFibWordEvidence,
  type FibWordEvidence,
  searchFibWordEvidence,
} from './wordProviders/tavily';
import {
  FIB_WORD_STORED_GENERATION_BATCH_LIMIT,
  type FibWordCategory,
  type FibWordEditorialCandidate,
  type FibWordRequest,
} from './wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  FIB_WORD_DAILY_BATCH_LIMIT,
  FIB_WORD_MONTHLY_BATCH_LIMIT,
  type FibWordPack,
  reserveFibWordPack,
  selectFibWordSearch,
  storeFibWordCandidates,
} from './wordPublication';
import { createFibWordSearchQuery } from './wordSearchPlan';
import {
  classifyFibWords,
  getFibWordsToClassify,
  storeFibWordTopics,
} from './wordTopicClassification';
import type { FibWordTopic } from './wordTopics';

const EXTERNAL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '40 seconds' } as const;
const REQUEST_TIMEOUT_MS = 120_000;
const MODEL_STEP = { ...EXTERNAL_STEP, timeout: '130 seconds' } as const;
const log = createLogger('fib-word-supply');
const generatedCandidatesSchema = z.array(z.unknown()).max(FIB_WORD_STORED_GENERATION_BATCH_LIMIT);
const persistedGenerationSchema = z.union([
  generatedCandidatesSchema,
  z.strictObject({
    candidates: generatedCandidatesSchema,
    validation: outputValidationSummarySchema,
  }),
]);

/** Old generate checkpoints were arrays; validate either durable format without regenerating. */
function readGeneratedCandidates(value: unknown): FibWordEditorialCandidate[] {
  const generated = persistedGenerationSchema.parse(value);
  return (Array.isArray(generated) ? generated : generated.candidates).map(
    parseFibWordEditorialCandidate,
  );
}

interface FibWordSupplyParams {
  readonly day: string;
  readonly batchLimit?: number;
  readonly force?: boolean;
  /** Unique id for admin manual triggers; keeps pack ids collision-free. */
  readonly runId?: string;
}

function createRequest(
  category: FibWordCategory,
  evidence: readonly FibWordEvidence[],
  topic?: FibWordTopic | null,
): FibWordRequest {
  return {
    category,
    topic,
    evidence,
    deadlineAt: Date.now() + REQUEST_TIMEOUT_MS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

/** Durable checkpoints bound each external operation; no HTTP step is automatically retried. */
export class FibWordSupplyWorkflow extends WorkflowEntrypoint<Env, FibWordSupplyParams> {
  async run(event: WorkflowEvent<FibWordSupplyParams>, step: WorkflowStep) {
    const day = z.iso.date().parse(event.payload.day);
    const force = event.payload.force === true;
    const runId = z.string().min(1).max(64).optional().parse(event.payload.runId);
    const batchLimit = z
      .int()
      .min(FIB_WORD_DAILY_BATCH_LIMIT)
      .max(FIB_WORD_MONTHLY_BATCH_LIMIT)
      .parse(event.payload.batchLimit ?? FIB_WORD_DAILY_BATCH_LIMIT);
    const isEnabled = await step.do(
      'enabled',
      async () => this.env.FIB_WORD_SUPPLY_ENABLED === 'true',
    );
    if (!isEnabled) return { status: 'disabled' };
    if (day.slice(0, 7) !== new Date().toISOString().slice(0, 7)) return { status: 'expired' };
    if (!force && !(await step.do('budget-initial', () => isEditorialBudgetAvailable(this.env.DB))))
      return { status: 'budget_exhausted' };
    await step.do('retention', () => cleanupFibWordAudit(this.env.DB, Date.now()));
    try {
      await step.do('classify-history', MODEL_STEP, async () => {
        const words = await getFibWordsToClassify(this.env.DB);
        if (words.length === 0) return;
        const identity = force && runId !== undefined ? `${day}:force:${runId}` : day;
        await claimEditorialModelRequest(
          this.env.DB,
          `fib:history:${identity}`,
          'fibking',
          GEMINI_FIB_WORD_MODEL,
          'generation',
          Date.now(),
          { force },
        );
        const classifications = await classifyFibWords(this.env.GEMINI_API_KEY, words, {
          workflowId: identity,
        });
        await storeFibWordTopics(this.env.DB, words, classifications);
      });
    } catch (error) {
      if (getAiDiagnostic(error) !== undefined)
        log.warn('historical topic classification failed', { day, runId });
      else
        log.error('historical topic classification failed', {
          error: error instanceof Error ? error.message : String(error),
        });
    }
    for (let batchIndex = 0; batchIndex < batchLimit; batchIndex += 1) {
      if (
        !force &&
        !(await step.do(`budget-${batchIndex}`, () => isEditorialBudgetAvailable(this.env.DB)))
      )
        return { status: 'budget_exhausted' };
      const capacity = await step.do(`capacity-${batchIndex}`, () =>
        measureDatabaseCapacity(this.env.DB),
      );
      if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
      const pack = await step.do(`reserve-${batchIndex}`, () =>
        reserveFibWordPack(this.env.DB, day, batchIndex, { batchLimit, force, runId }),
      );
      if (pack === null) continue;
      if (await this.processPack(step, pack, batchIndex, force))
        return { status: 'awaitingApproval' };
      await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
    }
    return { status: 'complete' };
  }

  /**
   * Process one pack: search, discover, extract, generate, and store new
   * candidates, then stop at the approval gate. Returns true when the batch
   * stored new candidates (the run ends with outcome 'awaitingApproval');
   * false when nothing was generated and the run may continue with the
   * next batch. Approved candidates are ignored here — they wait for the
   * manual review/publish endpoints.
   */
  private async processPack(
    step: WorkflowStep,
    pack: FibWordPack,
    batchIndex: number,
    force: boolean,
  ): Promise<boolean> {
    let failureStage = 'searchSelection';
    try {
      const search = await step.do(`select-search-${batchIndex}`, () =>
        selectFibWordSearch(this.env.DB, pack),
      );
      failureStage = 'discovery';
      const discovery = await step.do(`discover-${batchIndex}`, EXTERNAL_STEP, async () => {
        await claimFibWordProviderRequest(this.env.DB, pack, 'discovery', { force });
        return searchFibWordEvidence(
          this.env.TAVILY_API_KEY,
          createFibWordSearchQuery(search.searchIndex),
        );
      });
      if (discovery.length > 0) {
        failureStage = 'extraction';
        const extraction = await step.do(`extract-${batchIndex}`, EXTERNAL_STEP, async () => {
          await claimFibWordProviderRequest(this.env.DB, pack, 'extraction', { force });
          return extractFibWordEvidence(this.env.TAVILY_API_KEY, discovery);
        });
        if (extraction.evidence.length > 0) {
          failureStage = 'generation';
          const generatedCandidates = await step.do(
            `generate-${batchIndex}`,
            MODEL_STEP,
            async () => {
              await claimFibWordProviderRequest(this.env.DB, pack, 'generation', { force });
              return createConfiguredFibWordProvider(this.env).generateBatch(
                createRequest(pack.category, extraction.evidence, search.topic),
                { packId: pack.id },
              );
            },
          );
          failureStage = 'candidateStorage';
          const parsedCandidates = readGeneratedCandidates(generatedCandidates);
          await step.do(`store-candidates-${batchIndex}`, () =>
            storeFibWordCandidates(this.env.DB, pack, parsedCandidates),
          );
          // Newly stored candidates are pending until a human approves
          // them: stop this batch — and the run — here, leave the pack
          // reserved, and run no verification, review or publish for it.
          // (An empty generation does not throw — allCandidatesRejected
          // fires only when the model returned candidates and every one
          // was rejected — so a zero-candidate store just returns false
          // below and the pack stays reserved like any other gated pack.)
          return parsedCandidates.length > 0;
        }
      }
      // No discovery or extraction produced candidates: nothing new to
      // approve. Leave the pack reserved and continue with the next batch.
      return false;
    } catch (error) {
      const diagnostic = getAiDiagnostic(error);
      const failureKind =
        diagnostic?.failureKind === 'configuration'
          ? 'unclassified'
          : diagnostic?.failureKind === 'cancelled'
            ? 'timedOut'
            : (diagnostic?.failureKind ?? getFibWordProviderFailureKind(error) ?? 'unclassified');
      await step.do(`fail-${batchIndex}`, async () => {
        await failFibWordPack(this.env.DB, pack, `${failureStage}:${failureKind}`);
        const context = {
          packId: pack.id,
          failureStage,
          failureKind,
        };
        if (diagnostic !== undefined) log.warn('editorial pack failed', context);
        else
          log.error('editorial pack failed', {
            ...context,
            error: error instanceof Error ? error.message : String(error),
          });
      });
      throw error;
    }
  }
}
