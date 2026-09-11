/** Free-tier editorial workflow: separately bounded search, generation, review, and publication. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import { cleanupFibWordAudit } from './maintenance';
import {
  getFibWordReviewCandidates,
  storeFibWordCandidates,
  updateFibWordCandidateEvidence,
} from './wordCandidatePool';
import { createConfiguredFibWordProvider } from './wordProviders';
import {
  extractFibWordEvidence,
  type FibWordEvidence,
  searchFibWordEvidence,
} from './wordProviders/tavily';
import type {
  FibWordCategory,
  FibWordEditorialCandidate,
  FibWordRequest,
} from './wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  FIB_WORD_DAILY_BATCH_LIMIT,
  FIB_WORD_MONTHLY_BATCH_LIMIT,
  type FibWordPack,
  publishFibWordPack,
  reserveFibWordPack,
} from './wordPublication';
import { createFibWordSearchQuery } from './wordSearchPlan';

const EXTERNAL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '40 seconds' } as const;
const REQUEST_TIMEOUT_MS = 120_000;
const MODEL_STEP = { ...EXTERNAL_STEP, timeout: '130 seconds' } as const;
const log = createLogger('fib-word-supply');

interface FibWordSupplyParams {
  readonly day: string;
  readonly batchLimit?: number;
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

/** Durable checkpoints bound each external operation; no HTTP step is automatically retried. */
export class FibWordSupplyWorkflow extends WorkflowEntrypoint<Env, FibWordSupplyParams> {
  async run(event: WorkflowEvent<FibWordSupplyParams>, step: WorkflowStep) {
    const day = z.iso.date().parse(event.payload.day);
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
    await step.do('retention', () => cleanupFibWordAudit(this.env.DB, Date.now()));
    for (let batchIndex = 0; batchIndex < batchLimit; batchIndex += 1) {
      const capacity = await step.do(`capacity-${batchIndex}`, () =>
        measureDatabaseCapacity(this.env.DB),
      );
      if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
      const pack = await step.do(`reserve-${batchIndex}`, () =>
        reserveFibWordPack(this.env.DB, day, batchIndex, batchLimit),
      );
      if (pack === null) continue;
      await this.processPack(step, pack, batchIndex);
      await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
    }
    return { status: 'complete' };
  }

  private async processPack(step: WorkflowStep, pack: FibWordPack, batchIndex: number) {
    let failureStage = 'inventoryReviewSelection';
    try {
      let candidates = await step.do(`review-candidates-${batchIndex}`, () =>
        getFibWordReviewCandidates(this.env.DB, pack),
      );
      if (candidates.length === 0) {
        failureStage = 'discovery';
        const discovery = await step.do(`discover-${batchIndex}`, EXTERNAL_STEP, async () => {
          await claimFibWordProviderRequest(this.env.DB, pack, 'discovery');
          return searchFibWordEvidence(
            this.env.TAVILY_API_KEY,
            createFibWordSearchQuery(pack.searchIndex),
          );
        });
        if (discovery.length > 0) {
          failureStage = 'extraction';
          const extraction = await step.do(`extract-${batchIndex}`, EXTERNAL_STEP, async () => {
            await claimFibWordProviderRequest(this.env.DB, pack, 'extraction');
            return extractFibWordEvidence(this.env.TAVILY_API_KEY, discovery);
          });
          if (extraction.evidence.length > 0) {
            failureStage = 'generation';
            const generatedCandidates = await step.do(
              `generate-${batchIndex}`,
              MODEL_STEP,
              async () => {
                await claimFibWordProviderRequest(this.env.DB, pack, 'generation');
                return [
                  ...(await createConfiguredFibWordProvider(this.env).generateBatch(
                    createRequest(pack.category, extraction.evidence),
                  )),
                ];
              },
            );
            failureStage = 'candidateStorage';
            await step.do(`store-candidates-${batchIndex}`, () =>
              storeFibWordCandidates(this.env.DB, pack, generatedCandidates),
            );
            candidates = await step.do(`generated-review-candidates-${batchIndex}`, () =>
              getFibWordReviewCandidates(this.env.DB, pack),
            );
          }
        }
      }
      const verifiedCandidates: FibWordEditorialCandidate[] = [];
      for (const [candidateIndex, candidate] of candidates.entries()) {
        if (candidate.evidence.length > 0) {
          verifiedCandidates.push(candidate);
          continue;
        }
        failureStage = `verification-${candidateIndex}`;
        const sources = await step.do(
          `verify-${batchIndex}-${candidateIndex}`,
          EXTERNAL_STEP,
          async () => {
            await claimFibWordProviderRequest(this.env.DB, pack, `verification-${candidateIndex}`);
            return searchFibWordEvidence(
              this.env.TAVILY_API_KEY,
              `"${candidate.word}" 词典 释义 出处`,
            );
          },
        );
        let evidence: FibWordEvidence[] = [];
        if (sources.length > 0) {
          failureStage = `verification-extraction-${candidateIndex}`;
          const extraction = await step.do(
            `extract-verification-${batchIndex}-${candidateIndex}`,
            EXTERNAL_STEP,
            async () => {
              await claimFibWordProviderRequest(
                this.env.DB,
                pack,
                `verification-extraction-${candidateIndex}`,
              );
              return extractFibWordEvidence(this.env.TAVILY_API_KEY, sources);
            },
          );
          evidence = extraction.evidence;
        }
        const verifiedCandidate = { ...candidate, evidence };
        await step.do(`store-evidence-${batchIndex}-${candidateIndex}`, () =>
          updateFibWordCandidateEvidence(this.env.DB, pack, verifiedCandidate),
        );
        verifiedCandidates.push(verifiedCandidate);
      }
      failureStage = 'review';
      if (verifiedCandidates.length > 0)
        await step.sleep(`review-spacing-${batchIndex}`, '20 seconds');
      const reviews =
        verifiedCandidates.length === 0
          ? []
          : await step.do(`review-${batchIndex}`, MODEL_STEP, async () => {
              await claimFibWordProviderRequest(this.env.DB, pack, 'review');
              return [
                ...(await createConfiguredFibWordProvider(this.env).reviewBatch(
                  createRequest(pack.category, []),
                  verifiedCandidates,
                )),
              ];
            });
      failureStage = 'publication';
      await step.do(`publish-${batchIndex}`, () =>
        publishFibWordPack(this.env.DB, pack, verifiedCandidates, reviews, [
          ...new Set(verifiedCandidates.flatMap(({ evidence }) => evidence.map(({ url }) => url))),
        ]),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureKind =
        message.match(
          /\[(timedOut|authenticationFailed|rateLimited|serviceUnavailable|invalidOutput|requestFailed)\]/,
        )?.[1] ?? 'unclassified';
      await step.do(`fail-${batchIndex}`, async () => {
        await failFibWordPack(this.env.DB, pack, `${failureStage}:${failureKind}`);
        log.error('editorial pack failed', {
          packId: pack.id,
          failureStage,
          failureKind,
          error: message,
        });
      });
      throw error;
    }
  }
}
