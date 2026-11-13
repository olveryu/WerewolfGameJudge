/** Administrator commands bind immutable content and the exact review revision, atomically. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import {
  type WordSubmissionAction,
  wordSubmissionActionResultSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';

import type { Env } from '../../env';
import { WORKER_WORD_SUBMISSION_ADAPTERS } from '../../games/catalog';
import { isEditorialBudgetAvailable } from '../../platform/ai/editorialBudget';
import { sha256Hex } from '../../platform/crypto/sha256Hex';
import { createLogger } from '../../platform/observability/logger';
import type {
  SubmissionPublication,
  WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import {
  readStoredSubmissionBatch,
  refreshSubmissionSearch,
  type StoredSubmissionItem,
} from './repository';

const log = createLogger('word-submission-operations');
const eligibleStates = {
  review: ['pending', 'failed', 'rejected', 'passed'],
  publish: ['passed'],
  dismiss: ['pending', 'failed', 'rejected', 'passed'],
  approve: ['rejected'],
  unpublish: ['published'],
} as const;

/** Only this action's unfinished items transition; concurrent or repeated recovery is idempotent. */
export async function failSubmissionReview(db: D1Database, id: string, failure: string) {
  const action = await db
    .prepare("SELECT batch_id FROM word_submission_actions WHERE id = ? AND action = 'review'")
    .bind(id)
    .first<{ batch_id: string }>();
  if (action === null) throw new Error('Review failure has no matching action');
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO word_submission_events
      (action_id, item_id, action, actor, reason, created_at)
      SELECT ?, id, 'failed', 'review-workflow', ?, ? FROM word_submission_items
      WHERE review_id = ? AND status = 'reviewing'
        AND EXISTS (SELECT 1 FROM word_submission_actions WHERE id = ? AND status = 'queued')`,
      )
      .bind(id, failure, now, id, id),
    db
      .prepare(
        `UPDATE word_submission_items SET status = 'failed',
      failure = ?, revision = revision + 1 WHERE review_id = ? AND status = 'reviewing'
        AND EXISTS (SELECT 1 FROM word_submission_actions WHERE id = ? AND status = 'queued')`,
      )
      .bind(failure, id, id),
    db
      .prepare(
        `UPDATE word_submission_actions SET status = 'failed', completed_at = ?
      WHERE id = ? AND status = 'queued'`,
      )
      .bind(now, id),
    refreshSubmissionSearch(db, action.batch_id),
  ]);
}

/** Repeated dispatch confirms the same durable instance; it never creates another model attempt. */
export async function dispatchSubmissionReview(env: Env, batchId: string, id: string) {
  const action = await env.DB.prepare(
    `SELECT id, status FROM word_submission_actions
    WHERE id = ? AND batch_id = ? AND action = 'review'`,
  )
    .bind(id, batchId)
    .first<{ id: string; status: string }>();
  if (action === null) throw new HTTPException(404, { message: 'SUBMISSION_REVIEW_NOT_FOUND' });
  if (action.status === 'failed')
    throw new HTTPException(409, { message: 'REVIEW_FAILED_REFRESH_AND_START_NEW_ACTION' });
  if (action.status !== 'queued') return;
  try {
    await env.WORD_SUBMISSION_REVIEW.create({ id, params: { actionId: id } });
  } catch (error) {
    log.warn('review dispatch needs durable instance confirmation', { actionId: id });
    let status: InstanceStatus['status'];
    try {
      status = (await (await env.WORD_SUBMISSION_REVIEW.get(id)).status()).status;
    } catch {
      log.error('review dispatch unconfirmed; retry the same action', { actionId: id });
      throw new HTTPException(503, {
        message: 'REVIEW_DISPATCH_UNCONFIRMED_RETRY_SAME_ACTION_ID',
        cause: error,
      });
    }
    if (status === 'errored' || status === 'terminated') {
      await failSubmissionReview(env.DB, id, `dispatch:${status}`);
      throw new HTTPException(409, { message: 'REVIEW_FAILED_REFRESH_AND_START_NEW_ACTION' });
    }
    if (status === 'unknown')
      throw new HTTPException(503, {
        message: 'REVIEW_DISPATCH_UNCONFIRMED_RETRY_SAME_ACTION_ID',
        cause: error,
      });
  }
}

function itemMutation(
  db: D1Database,
  item: StoredSubmissionItem,
  input: WordSubmissionAction,
  adapter: WordSubmissionAdapter,
) {
  const status =
    input.action === 'review'
      ? 'reviewing'
      : input.action === 'publish'
        ? 'published'
        : input.action === 'dismiss'
          ? 'dismissed'
          : input.action === 'approve'
            ? 'passed'
            : 'unpublished';
  return db
    .prepare(
      `UPDATE word_submission_items SET status = ?, revision = revision + 1,
    publication_action_id = ?,
    review_id = CASE WHEN ? = 'review' THEN ? ELSE review_id END,
    review_version = CASE WHEN ? = 'review' THEN ? ELSE review_version END,
    review_model = CASE WHEN ? = 'review' THEN ? ELSE review_model END,
    review_json = CASE WHEN ? = 'review' THEN NULL ELSE review_json END,
    verified_material_json = CASE WHEN ? = 'review' THEN NULL ELSE verified_material_json END,
    approval_reason = CASE WHEN ? = 'review' THEN NULL WHEN ? = 'approve' THEN ? ELSE approval_reason END,
    failure = NULL
    WHERE id = ? AND EXISTS (SELECT 1 FROM word_submission_actions WHERE id = ? AND status = 'applying')`,
    )
    .bind(
      status,
      input.id,
      input.action,
      input.id,
      input.action,
      adapter.reviewVersion,
      input.action,
      adapter.model,
      input.action,
      input.action,
      input.action,
      input.action,
      input.reason,
      item.id,
      input.id,
    );
}

function publicationContext(
  item: StoredSubmissionItem,
  input: WordSubmissionAction,
  now: string,
): SubmissionPublication {
  if (item.review === null || item.verifiedContent === null)
    throw new HTTPException(409, { message: 'SUBMISSION_HAS_NO_COMPLETED_REVIEW' });
  return {
    itemId: item.id,
    identity: item.identity,
    content: item.content,
    verifiedContent: item.verifiedContent,
    review: item.review,
    actionId: input.id,
    now,
  };
}

function actionGate(adapter: WordSubmissionAdapter, input: WordSubmissionAction) {
  let gate = `item.status IN (${eligibleStates[input.action].map(() => '?').join(',')})`;
  const bindings: (string | number)[] = [...eligibleStates[input.action]];
  if (input.action === 'publish' || input.action === 'approve') {
    gate +=
      ' AND item.review_version = ? AND item.review_json IS NOT NULL AND item.verified_material_json IS NOT NULL';
    bindings.push(adapter.reviewVersion);
  }
  if (input.action === 'publish') {
    gate += ` AND (json_extract(item.review_json, '$.passed') = 1 OR item.approval_reason IS NOT NULL)
      AND NOT (${adapter.inventoryExistsSql})`;
  }
  if (input.action === 'approve')
    gate += ` AND json_extract(item.review_json, '$.canOverride') = 1`;
  return { gate, bindings };
}

/** Selection validation and all game inventory writes use the same D1 transaction. */
export async function applySubmissionAction(
  env: Env,
  batchId: string,
  input: WordSubmissionAction,
) {
  const hash = await sha256Hex(canonicalJson({ batchId, ...input }));
  const prior = await env.DB.prepare(
    'SELECT request_hash, status FROM word_submission_actions WHERE id = ?',
  )
    .bind(input.id)
    .first<{ request_hash: string; status: string }>();
  if (prior !== null) {
    if (prior.request_hash !== hash)
      throw new HTTPException(409, { message: 'ACTION_ID_PAYLOAD_MISMATCH' });
    if (input.action === 'review' && prior.status === 'queued')
      await dispatchSubmissionReview(env, batchId, input.id);
    return wordSubmissionActionResultSchema.parse({ id: input.id, status: prior.status });
  }
  if (['approve', 'dismiss', 'unpublish'].includes(input.action) && input.reason.length === 0)
    throw new HTTPException(400, { message: 'SUBMISSION_ACTION_REASON_REQUIRED' });
  const batch = await readStoredSubmissionBatch(env.DB, batchId);
  const adapter: WordSubmissionAdapter = WORKER_WORD_SUBMISSION_ADAPTERS[batch.game];
  const selected = input.items.map((entry) => batch.items.find((item) => item.id === entry.id));
  const items = selected.filter((item): item is StoredSubmissionItem => item !== undefined);
  if (items.length !== input.items.length)
    throw new HTTPException(409, { message: 'SUBMISSION_SELECTION_STALE_OR_NOT_ELIGIBLE' });
  if (
    input.action === 'publish' &&
    new Set(items.map((item) => item.identity)).size !== items.length
  )
    throw new HTTPException(409, { message: 'SUBMISSION_SELECTION_HAS_DUPLICATE_IDENTITIES' });
  if (input.action === 'review' && !(await isEditorialBudgetAvailable(env.DB)))
    throw new HTTPException(429, { message: 'EDITORIAL_MODEL_BUDGET_EXHAUSTED' });
  const now = new Date().toISOString();
  const { gate, bindings } = actionGate(adapter, input);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO word_submission_actions
      (id, batch_id, action, request_hash, items_json, reason, status, created_at)
      SELECT ?, ?, ?, ?, ?, ?, 'applying', ?
      WHERE (SELECT COUNT(*) FROM json_each(?) selected
        JOIN word_submission_items item ON item.id = json_extract(selected.value, '$.id')
        WHERE item.batch_id = ? AND item.content_hash = json_extract(selected.value, '$.contentHash')
          AND item.revision = json_extract(selected.value, '$.revision') AND ${gate}) = ?
      ON CONFLICT (id) DO NOTHING`,
    ).bind(
      input.id,
      batchId,
      input.action,
      hash,
      JSON.stringify(input.items),
      input.reason,
      now,
      JSON.stringify(input.items),
      batchId,
      ...bindings,
      input.items.length,
    ),
  ];
  for (const item of items) {
    statements.push(itemMutation(env.DB, item, input, adapter));
    if (input.action === 'publish')
      statements.push(...adapter.publish(env.DB, publicationContext(item, input, now)));
    if (input.action === 'unpublish')
      statements.push(...adapter.unpublish(env.DB, publicationContext(item, input, now)));
    statements.push(
      env.DB.prepare(
        `INSERT INTO word_submission_events
      (action_id, item_id, action, actor, reason, created_at)
      SELECT id, ?, action, 'shared-admin', reason, ? FROM word_submission_actions
      WHERE id = ? AND status = 'applying'`,
      ).bind(item.id, now, input.id),
    );
  }
  statements.push(refreshSubmissionSearch(env.DB, batchId));
  statements.push(
    env.DB.prepare(
      `UPDATE word_submission_actions SET status = ?, completed_at = ?
    WHERE id = ? AND status = 'applying'`,
    ).bind(
      input.action === 'review' ? 'queued' : 'complete',
      input.action === 'review' ? null : now,
      input.id,
    ),
  );
  const result = await env.DB.batch(statements);
  if (result[0]?.meta.changes !== 1) {
    const receipt = await env.DB.prepare(
      'SELECT request_hash, status FROM word_submission_actions WHERE id = ?',
    )
      .bind(input.id)
      .first<{ request_hash: string; status: string }>();
    if (receipt === null)
      throw new HTTPException(409, { message: 'SUBMISSION_SELECTION_STALE_OR_NOT_ELIGIBLE' });
    if (receipt.request_hash !== hash)
      throw new HTTPException(409, { message: 'ACTION_ID_PAYLOAD_MISMATCH' });
    if (input.action === 'review' && receipt.status === 'queued')
      await dispatchSubmissionReview(env, batchId, input.id);
    return wordSubmissionActionResultSchema.parse({ id: input.id, status: receipt.status });
  }
  if (input.action === 'review') await dispatchSubmissionReview(env, batchId, input.id);
  return { id: input.id, status: input.action === 'review' ? 'queued' : 'complete' } as const;
}
