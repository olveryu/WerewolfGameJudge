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
import type { WordSubmissionAdapter } from '../../platform/wordSupply/submissionAdapter';
import { failSubmissionReview } from './operations';
import { parseSubmissionObject, refreshSubmissionSearch } from './repository';

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

async function claimEvidenceRequest(db: D1Database, id: string, limit: number) {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `INSERT INTO word_submission_evidence_requests (id, claimed_at)
    SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM word_submission_evidence_requests
      WHERE claimed_at >= ? LIMIT 1 OFFSET ?)
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    )
    .bind(id, now, `${now.slice(0, 7)}-01T00:00:00.000Z`, limit - 1)
    .first();
  if (row === null) throw new Error('SUBMISSION_EVIDENCE_BUDGET_EXHAUSTED_OR_REQUEST_CONSUMED');
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
  statements.push(refreshSubmissionSearch(db, batchId));
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
      for (const [index, items] of reviewGroups(job.items, adapter.reviewBatchLimit).entries()) {
        const prepared: Record<string, unknown>[] = [];
        for (const item of items) {
          stage = 'evidence';
          const serialized = await step.do(`prepare-${item.id}`, EXTERNAL_STEP, async () => {
            const content = parseSubmissionObject(item.material_json);
            if (adapter.prepareReview === undefined) return JSON.stringify(content);
            const limit = adapter.evidenceMonthlyLimit;
            if (limit === undefined)
              throw new Error('Evidence preparation has no configured quota');
            return JSON.stringify(
              await adapter.prepareReview(this.env, content, async (operation) => {
                stage = 'evidence-budget';
                await claimEvidenceRequest(
                  this.env.DB,
                  `${actionId}:${item.id}:${operation}`,
                  limit,
                );
                stage = 'evidence';
              }),
            );
          });
          prepared.push(parseSubmissionObject(serialized));
        }
        stage = 'model-review';
        const serialized = await step.do(`review-${index}`, EXTERNAL_STEP, async () => {
          stage = 'model-budget';
          await claimEditorialModelRequest(
            this.env.DB,
            `submission:${actionId}:${index}`,
            job.game,
            adapter.model,
          );
          stage = 'model-review';
          return JSON.stringify(await adapter.review(this.env, prepared, { workflowId: actionId }));
        });
        const parsed: unknown = JSON.parse(serialized);
        const results = reviewedSchema.parse(parsed);
        stage = 'store-review';
        await step.do(`store-${index}`, () =>
          storeReviewResults(this.env.DB, actionId, job.batchId, items, results),
        );
      }
      await step.do('complete-review', async () => {
        await this.env.DB.prepare(
          `UPDATE word_submission_actions SET status = 'complete', completed_at = ?
          WHERE id = ? AND status = 'queued'`,
        )
          .bind(new Date().toISOString(), actionId)
          .run();
      });
      return { status: 'complete' };
    } catch (error) {
      const failure = `${stage}:${stage.endsWith('-budget') ? 'quota_claim_failed' : (getAiDiagnostic(error)?.failureKind ?? 'infrastructure_failure')}`;
      await step.do('fail-review', async () => {
        await failSubmissionReview(this.env.DB, actionId, failure);
        if (getAiDiagnostic(error) === undefined)
          log.error('external review failed', { actionId, stage });
        else log.warn('external review failed', { actionId, stage });
      });
      throw error;
    }
  }
}
