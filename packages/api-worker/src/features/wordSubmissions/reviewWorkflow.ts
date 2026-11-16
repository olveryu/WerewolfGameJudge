/** Durable external review checkpoints; this workflow has no publication operation. */
import {
  type GameWordGame,
  wordSubmissionReviewSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';

import type { Env } from '../../env';
import { WORKER_WORD_SUBMISSION_ADAPTERS } from '../../games/catalog';
import { getAiDiagnostic } from '../../platform/ai/aiError';
import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createLogger } from '../../platform/observability/logger';
import {
  SubmissionReviewItemError,
  type WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import { failSubmissionReview, failSubmissionReviewItem } from './operations';
import { parseSubmissionObject } from './repository';

export interface WordSubmissionReviewParams {
  readonly actionId: string;
}
const EXTERNAL_STEP = { retries: { limit: 0, delay: '1 second' }, timeout: '130 seconds' } as const;
const log = createLogger('word-submission-review');
const reviewedSchema = z.array(
  z.strictObject({
    review: wordSubmissionReviewSchema,
    verifiedContent: z.record(z.string(), z.unknown()),
  }),
);
const failedPreparationSchema = z.strictObject({ reviewItemFailure: z.string().min(1) });

async function loadJob(db: D1Database, actionId: string) {
  const action = await db
    .prepare(
      `SELECT b.game, a.batch_id FROM word_submission_actions a
    JOIN word_submission_batches b ON b.id = a.batch_id
    WHERE a.id = ? AND a.action = 'review' AND a.status = 'queued'`,
    )
    .bind(actionId)
    .first<{ game: GameWordGame; batch_id: string }>();
  if (action === null) throw new Error('Review action is not queued');
  const rows = await db
    .prepare(
      `SELECT id, category, material_json, review_version
    FROM word_submission_items WHERE batch_id = ? AND review_id = ? AND status = 'reviewing' ORDER BY rowid`,
    )
    .bind(action.batch_id, actionId)
    .all<{ id: string; category: string; material_json: string; review_version: string }>();
  return { game: action.game, batchId: action.batch_id, items: rows.results };
}

async function claimEvidenceRequest(db: D1Database, id: string) {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `INSERT INTO word_submission_evidence_requests (id, claimed_at)
    VALUES (?, ?)
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    )
    .bind(id, now)
    .first();
  if (row === null) throw new Error('SUBMISSION_EVIDENCE_REQUEST_CONSUMED');
}

function reviewGroups(items: Awaited<ReturnType<typeof loadJob>>['items'], limit: number) {
  const categories = [...new Set(items.map((item) => item.category))];
  return categories.flatMap((category) => {
    const group = items.filter((item) => item.category === category);
    const chunks: (typeof items)[] = [];
    for (let index = 0; index < group.length; index += limit)
      chunks.push(group.slice(index, index + limit));
    return chunks;
  });
}

async function storeReviewResults(
  db: D1Database,
  actionId: string,
  batchId: string,
  items: Awaited<ReturnType<typeof loadJob>>['items'],
  results: z.output<typeof reviewedSchema>,
) {
  if (items.length !== results.length) throw new Error('Submission review result count mismatch');
  const statements: D1PreparedStatement[] = [];
  for (const [index, item] of items.entries()) {
    const result = results[index];
    if (result === undefined) throw new Error('Submission review result missing');
    const status = result.review.passed ? 'passed' : 'rejected';
    statements.push(
      db
        .prepare(
          `INSERT INTO word_submission_events (action_id, item_id, action, actor, reason, created_at)
        SELECT ?, id, ?, 'review-workflow', ?, ? FROM word_submission_items
        WHERE id = ? AND review_id = ? AND status = 'reviewing'`,
        )
        .bind(actionId, status, result.review.reason, new Date().toISOString(), item.id, actionId),
      db
        .prepare(
          `UPDATE word_submission_items SET status = ?, review_json = ?,
        verified_material_json = ?, revision = revision + 1, failure = NULL
        WHERE id = ? AND review_id = ? AND status = 'reviewing'`,
        )
        .bind(
          status,
          JSON.stringify(result.review),
          JSON.stringify(result.verifiedContent),
          item.id,
          actionId,
        ),
    );
  }
  await db.batch(statements);
}

/** Explicit retries create new administrator actions; uncertain provider calls are never replayed. */
export class WordSubmissionReviewWorkflow extends WorkflowEntrypoint<
  Env,
  WordSubmissionReviewParams
> {
  async run(event: WorkflowEvent<WordSubmissionReviewParams>, step: WorkflowStep) {
    const actionId = z.uuid().parse(event.payload.actionId);
    let stage = 'load-review';
    try {
      const job = await step.do('load-review', () => loadJob(this.env.DB, actionId));
      const adapter: WordSubmissionAdapter = WORKER_WORD_SUBMISSION_ADAPTERS[job.game];
      stage = 'review-version';
      if (job.items.some((item) => item.review_version !== adapter.reviewVersion))
        throw new Error('Submission review version changed; start a new review');
      let hasItemFailures = false;
      for (const [index, items] of reviewGroups(job.items, adapter.reviewBatchLimit).entries()) {
        const prepared: Record<string, unknown>[] = [];
        const preparedItems: typeof items = [];
        for (const item of items) {
          stage = 'evidence';
          const serialized = await step.do(`prepare-${item.id}`, EXTERNAL_STEP, async () => {
            const content = parseSubmissionObject(item.material_json);
            try {
              const verified =
                adapter.prepareReview === undefined
                  ? content
                  : await adapter.prepareReview(
                      this.env,
                      content,
                      async (operation) => {
                        stage = 'evidence-budget';
                        await claimEvidenceRequest(
                          this.env.DB,
                          `${actionId}:${item.id}:${operation}`,
                        );
                        stage = 'evidence';
                      },
                      { workflowId: actionId, itemId: item.id },
                    );
              return JSON.stringify(verified);
            } catch (error) {
              if (!(error instanceof SubmissionReviewItemError)) throw error;
              return JSON.stringify({ reviewItemFailure: error.failure });
            }
          });
          const result = parseSubmissionObject(serialized);
          const itemFailure = failedPreparationSchema.safeParse(result);
          if (itemFailure.success) {
            stage = 'store-item-failure';
            await step.do(`fail-item-${item.id}`, () =>
              failSubmissionReviewItem(
                this.env.DB,
                actionId,
                job.batchId,
                item.id,
                itemFailure.data.reviewItemFailure,
              ),
            );
            hasItemFailures = true;
            continue;
          }
          prepared.push(result);
          preparedItems.push(item);
        }
        if (preparedItems.length === 0) continue;
        stage = 'model-review';
        const serialized = await step.do(`review-${index}`, EXTERNAL_STEP, async () => {
          stage = 'model-budget';
          await claimEditorialModelRequest(
            this.env.DB,
            `submission:${actionId}:${index}`,
            job.game,
            adapter.model,
            'review',
            Date.now(),
          );
          stage = 'model-review';
          return JSON.stringify(await adapter.review(this.env, prepared, { workflowId: actionId }));
        });
        const parsed: unknown = JSON.parse(serialized);
        const results = reviewedSchema.parse(parsed);
        stage = 'store-review';
        await step.do(`store-${index}`, () =>
          storeReviewResults(this.env.DB, actionId, job.batchId, preparedItems, results),
        );
      }
      const status = hasItemFailures ? 'failed' : 'complete';
      stage = 'complete-review';
      await step.do('complete-review', async () => {
        await this.env.DB.prepare(
          `UPDATE word_submission_actions SET status = ?, completed_at = ?
          WHERE id = ? AND status = 'queued'`,
        )
          .bind(status, new Date().toISOString(), actionId)
          .run();
      });
      return { status };
    } catch (error) {
      const diagnostic = getAiDiagnostic(error);
      const failure = `${stage}:${stage.endsWith('-budget') ? 'quota_claim_failed' : (diagnostic?.failureKind ?? 'infrastructure_failure')}`;
      await step.do('fail-review', async () => {
        await failSubmissionReview(this.env.DB, actionId, failure);
        if (diagnostic === undefined)
          log.error('external review failed', { actionId, stage, failure });
        else log.warn('external review failed', { actionId, stage, failure, diagnostic });
      });
      throw error;
    }
  }
}
