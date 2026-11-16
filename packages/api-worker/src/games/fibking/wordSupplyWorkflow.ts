/** Free-tier editorial workflow: separately bounded search, generation, and
 * storage. Review and publication are manual — the workflow only generates
 * one pack's candidates, stores them as pending submission items, and stops.
 * One trigger runs one pack; there is no daily batch limit: the admin
 * controls how often to trigger by hand. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { storeSupplySubmissions } from '../../features/wordSubmissions/ingestion';
import { getAiDiagnostic, outputValidationSummarySchema } from '../../platform/ai/aiError';
import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import type { WordSupplySubmissionItem } from '../../platform/wordSupply/submissionAdapter';
import { cleanupFibWordAudit } from './maintenance';
import {
  FIB_WORD_CATEGORY_IDS,
  type FibWordCategory,
  type FibWordSupplyCategory,
} from './wordCategories';
import {
  classifyFibWords,
  getFibWordsToClassify,
  storeFibWordCategories,
} from './wordCategoryClassification';
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
  type FibWordEditorialCandidate,
  type FibWordRequest,
} from './wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  type FibWordPack,
  reserveFibWordPack,
  selectFibWordSearch,
} from './wordPublication';
import { createFibWordSearchQuery } from './wordSearchPlan';

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
  /** Unique id for admin manual triggers (a UUID); keeps pack ids collision-free. */
  readonly runId: string;
  readonly category: string;
}

function createRequest(
  category: FibWordCategory,
  evidence: readonly FibWordEvidence[],
): FibWordRequest {
  return {
    category,
    evidence,
    deadlineAt: Date.now() + REQUEST_TIMEOUT_MS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

/** Map generated candidates to submission items; the submission references
 * carry the Tavily evidence (url + a note of at most 300 chars). */
function toSubmissionItems(
  pack: FibWordPack,
  candidates: readonly FibWordEditorialCandidate[],
): readonly WordSupplySubmissionItem[] {
  return candidates.map((candidate, index) => ({
    clientItemId: `${pack.id}:${index}`,
    content: {
      word: candidate.word,
      definition: candidate.definition,
      category: candidate.category,
      references: candidate.evidence.map((evidence) => ({
        url: evidence.url,
        note: evidence.content.slice(0, 300),
      })),
    },
  }));
}

/** Durable checkpoints bound each external operation; no HTTP step is automatically retried. */
export class FibWordSupplyWorkflow extends WorkflowEntrypoint<Env, FibWordSupplyParams> {
  async run(event: WorkflowEvent<FibWordSupplyParams>, step: WorkflowStep) {
    const day = z.iso.date().parse(event.payload.day);
    // The batch id is the run's UUID: the submission batch header schema
    // requires a UUID, so the workflow instance id (`<game>-manual-<uuid>`)
    // cannot serve as the batch id.
    const runId = z.uuid().parse(event.payload.runId);
    const category: FibWordSupplyCategory = z
      .enum(FIB_WORD_CATEGORY_IDS)
      .parse(event.payload.category);
    const isEnabled = await step.do(
      'enabled',
      async () => this.env.FIB_WORD_SUPPLY_ENABLED === 'true',
    );
    if (!isEnabled) return { status: 'disabled' };
    if (day.slice(0, 7) !== new Date().toISOString().slice(0, 7)) return { status: 'expired' };
    await step.do('retention', () => cleanupFibWordAudit(this.env.DB, Date.now()));
    try {
      await step.do('classify-history', MODEL_STEP, async () => {
        const words = await getFibWordsToClassify(this.env.DB);
        if (words.length === 0) return;
        const identity = `${day}:${runId}`;
        await claimEditorialModelRequest(
          this.env.DB,
          `fib:history:${identity}`,
          'fibking',
          GEMINI_FIB_WORD_MODEL,
          'generation',
          Date.now(),
        );
        const classifications = await classifyFibWords(this.env.GEMINI_API_KEY, words, {
          workflowId: identity,
        });
        await storeFibWordCategories(this.env.DB, words, classifications);
      });
    } catch (error) {
      if (getAiDiagnostic(error) !== undefined)
        log.warn('historical category classification failed', { day, runId });
      else
        log.error('historical category classification failed', {
          error: error instanceof Error ? error.message : String(error),
        });
    }
    const capacity = await step.do('capacity', () => measureDatabaseCapacity(this.env.DB));
    if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
    const pack = await step.do('reserve', () =>
      reserveFibWordPack(this.env.DB, day, runId, category),
    );
    if (pack === null) return { status: 'complete', stored: 0 };
    const stored = await this.processPack(step, pack, runId);
    return { status: 'complete', stored };
  }

  /**
   * Process the run's one pack: search, discover, extract, generate, and
   * store new candidates as pending submission items, then stop. Returns
   * the number of items stored.
   */
  private async processPack(step: WorkflowStep, pack: FibWordPack, runId: string): Promise<number> {
    let failureStage = 'searchSelection';
    try {
      const search = await step.do('select-search', () => selectFibWordSearch(this.env.DB, pack));
      failureStage = 'discovery';
      const discovery = await step.do('discover', EXTERNAL_STEP, async () => {
        await claimFibWordProviderRequest(this.env.DB, pack, 'discovery');
        return searchFibWordEvidence(
          this.env.TAVILY_API_KEY,
          createFibWordSearchQuery(search.searchIndex),
        );
      });
      if (discovery.length > 0) {
        failureStage = 'extraction';
        const extraction = await step.do('extract', EXTERNAL_STEP, async () => {
          await claimFibWordProviderRequest(this.env.DB, pack, 'extraction');
          return extractFibWordEvidence(this.env.TAVILY_API_KEY, discovery);
        });
        if (extraction.evidence.length > 0) {
          failureStage = 'generation';
          const generatedCandidates = await step.do('generate', MODEL_STEP, async () => {
            await claimFibWordProviderRequest(this.env.DB, pack, 'generation');
            return createConfiguredFibWordProvider(this.env).generateBatch(
              createRequest(pack.category, extraction.evidence),
              { packId: pack.id },
            );
          });
          failureStage = 'candidateStorage';
          const parsedCandidates = readGeneratedCandidates(generatedCandidates);
          const stored = await step.do(
            'store',
            async () =>
              (
                await storeSupplySubmissions(
                  this.env.DB,
                  'fibking',
                  runId,
                  toSubmissionItems(pack, parsedCandidates),
                )
              ).items.length,
          );
          // Newly stored items are pending submissions until a human
          // endorses and reviews them: stop here, leave the pack reserved,
          // and run no verification, review or publish for it. (A
          // zero-candidate store cannot happen — generation throws
          // allCandidatesRejected on zero valid candidates — but if it ever
          // did, the pack stays reserved like any other gated pack.)
          return stored;
        }
      }
      // No discovery or extraction produced candidates: nothing new to
      // review. Leave the pack reserved and finish with nothing stored.
      return 0;
    } catch (error) {
      const diagnostic = getAiDiagnostic(error);
      const failureKind =
        diagnostic?.failureKind === 'configuration'
          ? 'unclassified'
          : diagnostic?.failureKind === 'cancelled'
            ? 'timedOut'
            : (diagnostic?.failureKind ?? getFibWordProviderFailureKind(error) ?? 'unclassified');
      await step.do('fail', async () => {
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
