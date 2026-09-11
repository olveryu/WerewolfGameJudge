/** Free-tier editorial workflow: separately bounded search, generation, review, and publication. */
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { measureDatabaseCapacity } from '../../platform/storage/capacity';
import { cleanupFibWordAudit } from './maintenance';
import { createConfiguredFibWordProvider } from './wordProviders';
import { type FibWordEvidence, searchFibWordEvidence } from './wordProviders/tavily';
import type { FibWordCategory, FibWordRequest } from './wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  FIB_WORD_DAILY_BATCH_LIMIT,
  getFibWordReviewCandidates,
  publishFibWordPack,
  reserveFibWordPack,
} from './wordPublication';

const EXTERNAL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '40 seconds' } as const;
const REQUEST_TIMEOUT_MS = 30_000;
const SEARCH_TOPICS = [
  '婚俗 礼仪',
  '传统器物 工艺',
  '饮食 市井',
  '航海 商贸',
  '书信 古典生活',
  '心理效应 认知',
  '小众网络用语',
  '地方民俗 行业术语',
];
const log = createLogger('fib-word-supply');

interface FibWordSupplyParams {
  readonly day: string;
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
    const isEnabled = await step.do(
      'enabled',
      async () => this.env.FIB_WORD_SUPPLY_ENABLED === 'true',
    );
    if (!isEnabled) return { status: 'disabled' };
    if (day.slice(0, 7) !== new Date().toISOString().slice(0, 7)) return { status: 'expired' };
    await step.do('retention', () => cleanupFibWordAudit(this.env.DB, Date.now()));
    for (let batchIndex = 0; batchIndex < FIB_WORD_DAILY_BATCH_LIMIT; batchIndex += 1) {
      const capacity = await step.do(`capacity-${batchIndex}`, () =>
        measureDatabaseCapacity(this.env.DB),
      );
      if (capacity === 'paused' || capacity === 'protected') return { status: capacity };
      const pack = await step.do(`reserve-${batchIndex}`, () =>
        reserveFibWordPack(this.env.DB, day, batchIndex),
      );
      if (pack === null) continue;
      let failureStage = 'discovery';
      try {
        const topic =
          SEARCH_TOPICS[
            (Number(day.slice(-2)) * FIB_WORD_DAILY_BATCH_LIMIT + batchIndex) % SEARCH_TOPICS.length
          ];
        if (topic === undefined) throw new Error('Fib search topic unavailable');
        const discovery = await step.do(`discover-${batchIndex}`, EXTERNAL_STEP, async () => {
          await claimFibWordProviderRequest(this.env.DB, pack, 'discovery');
          return searchFibWordEvidence(
            this.env.TAVILY_API_KEY,
            `中文 释义猜谜 桌游 公开题例 冷门词 词源 ${topic} ${day.slice(0, 7)}`,
          );
        });
        if (discovery.length === 0) throw new Error('Fib word discovery returned no evidence');
        failureStage = 'generation';
        const generatedCandidates = await step.do(
          `generate-${batchIndex}`,
          EXTERNAL_STEP,
          async () => {
            await claimFibWordProviderRequest(this.env.DB, pack, 'generation');
            return [
              ...(await createConfiguredFibWordProvider(this.env).generateBatch(
                createRequest(pack.category, discovery),
              )),
            ];
          },
        );
        failureStage = 'inventoryReviewSelection';
        const candidates = await step.do(`review-candidates-${batchIndex}`, () =>
          getFibWordReviewCandidates(this.env.DB, pack, generatedCandidates),
        );
        const evidence: FibWordEvidence[] = [];
        for (const [candidateIndex, candidate] of candidates.entries()) {
          failureStage = `verification-${candidateIndex}`;
          const sources = await step.do(
            `verify-${batchIndex}-${candidateIndex}`,
            EXTERNAL_STEP,
            async () => {
              await claimFibWordProviderRequest(
                this.env.DB,
                pack,
                `verification-${candidateIndex}`,
              );
              return searchFibWordEvidence(
                this.env.TAVILY_API_KEY,
                `"${candidate.word}" 词典 释义 出处`,
              );
            },
          );
          evidence.push(...sources);
        }
        failureStage = 'review';
        await step.sleep(`review-spacing-${batchIndex}`, '20 seconds');
        const reviews = await step.do(`review-${batchIndex}`, EXTERNAL_STEP, async () => {
          await claimFibWordProviderRequest(this.env.DB, pack, 'review');
          return [
            ...(await createConfiguredFibWordProvider(this.env).reviewBatch(
              createRequest(pack.category, evidence),
              candidates,
            )),
          ];
        });
        const groundedReviews = reviews.map((review) => {
          if (
            review.decision === 'rejected' ||
            evidence.some((source) => source.content.includes(review.word))
          )
            return review;
          return {
            ...review,
            decision: 'rejected' as const,
            qualityChecks: { ...review.qualityChecks, isEstablishedTerm: false },
            reason: '检索资料未能核实该词项，暂不入库。',
          };
        });
        failureStage = 'publication';
        await step.do(`publish-${batchIndex}`, () =>
          publishFibWordPack(this.env.DB, pack, candidates, groundedReviews, [
            ...new Set([...discovery, ...evidence].map((source) => source.url)),
          ]),
        );
        await step.sleep(`batch-spacing-${batchIndex}`, '20 seconds');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failureKind =
          message.match(
            /\[(timedOut|authenticationFailed|rateLimited|serviceUnavailable|invalidOutput|requestFailed)\]/,
          )?.[1] ?? 'unclassified';
        await step.do(`fail-${batchIndex}`, () =>
          failFibWordPack(this.env.DB, pack, `${failureStage}:${failureKind}`),
        );
        log.error('editorial pack failed', {
          packId: pack.id,
          failureStage,
          failureKind,
          error: message,
        });
        throw error;
      }
    }
    return { status: 'complete' };
  }
}
