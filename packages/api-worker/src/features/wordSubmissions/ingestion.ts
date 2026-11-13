/** Strict validation, agent-scoped idempotency, and atomic submission quotas. No model calls. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import {
  WORD_SUBMISSION_DAILY_LIMIT,
  WORD_SUBMISSION_PENDING_LIMIT,
  type WordSubmissionInput,
  type WordSubmissionValidation,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

import { WORKER_WORD_SUBMISSION_ADAPTERS } from '../../games/catalog';
import { AiOutputValidationError } from '../../platform/ai/aiError';
import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { SubmissionMaterial } from '../../platform/wordSupply/submissionAdapter';
import type { SubmissionPrincipal } from './credentials';
import { readSubmissionBatch } from './repository';

interface ValidatedItem extends SubmissionMaterial {
  readonly clientItemId: string;
  readonly contentHash: string;
  readonly duplicateOf: string | null;
}

/** Structural and semantic errors are content failures; database/programming failures propagate. */
export async function validateSubmission(
  db: D1Database,
  input: WordSubmissionInput,
  principal: SubmissionPrincipal,
): Promise<{ validation: WordSubmissionValidation; items: ValidatedItem[] }> {
  if (!principal.agent.games.includes(input.game))
    throw new HTTPException(403, { message: 'SUBMISSION_GAME_NOT_AUTHORIZED' });
  const adapter = WORKER_WORD_SUBMISSION_ADAPTERS[input.game];
  const items: ValidatedItem[] = [];
  const results = new Map<string, WordSubmissionValidation['items'][number]>();
  for (const entry of input.items) {
    let material: SubmissionMaterial;
    try {
      material = await adapter.normalize(entry.content);
    } catch (error) {
      if (!(error instanceof ZodError) && !(error instanceof AiOutputValidationError)) throw error;
      results.set(entry.clientItemId, {
        clientItemId: entry.clientItemId,
        status: 'invalid',
        reason:
          error instanceof ZodError
            ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
            : error.message,
      });
      continue;
    }
    const contentHash = await sha256Hex(
      canonicalJson({ game: input.game, content: material.content }),
    );
    items.push({ ...material, clientItemId: entry.clientItemId, contentHash, duplicateOf: null });
  }
  const matches = await db.batch<{ key: string }>([
    db
      .prepare(
        `SELECT DISTINCT content_hash AS key FROM word_submission_items
      WHERE game = ? AND content_hash IN (SELECT value FROM json_each(?)) AND status <> 'duplicate'`,
      )
      .bind(input.game, JSON.stringify(items.map((item) => item.contentHash))),
    db
      .prepare(
        `SELECT item.identity AS key
      FROM (SELECT value AS identity FROM json_each(?)) item WHERE ${adapter.inventoryExistsSql}`,
      )
      .bind(JSON.stringify(items.map((item) => item.identity))),
  ]);
  const [previous, inventory] = matches;
  if (previous === undefined || inventory === undefined)
    throw new Error('Submission validation query results missing');
  const previousHashes = new Set(previous.results.map((row) => row.key));
  const inventoryIdentities = new Set(inventory.results.map((row) => row.key));
  const seen = new Map<string, string>();
  const validated = items.map((item) => {
    const duplicateOf = inventoryIdentities.has(item.identity)
      ? `inventory:${item.identity}`
      : !previousHashes.has(item.contentHash)
        ? (seen.get(item.contentHash) ?? null)
        : 'previous-submission';
    seen.set(item.contentHash, item.clientItemId);
    results.set(item.clientItemId, {
      clientItemId: item.clientItemId,
      status: duplicateOf === null ? 'valid' : 'duplicate',
      reason:
        duplicateOf === null
          ? null
          : 'Content already exists; it will not be reviewed or published again',
    });
    return { ...item, duplicateOf };
  });
  return {
    validation: {
      items: input.items.map(({ clientItemId }) => {
        const result = results.get(clientItemId);
        if (result === undefined) throw new Error('Submission validation result missing');
        return result;
      }),
    },
    items: validated,
  };
}

/** Retries return their original batch even after quotas fill; changed payloads cannot reuse keys. */
export async function findSubmissionReplay(
  db: D1Database,
  agentId: string,
  key: string,
  hash: string,
) {
  const row = await db
    .prepare(
      `SELECT id, request_hash FROM word_submission_batches
    WHERE agent_id = ? AND idempotency_key = ?`,
    )
    .bind(agentId, key)
    .first<{ id: string; request_hash: string }>();
  if (row === null) return null;
  if (row.request_hash !== hash)
    throw new HTTPException(409, { message: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' });
  return readSubmissionBatch(db, row.id, agentId);
}

/** All quota claims, batch data, and queue counters commit or roll back together. */
export async function storeSubmission(
  db: D1Database,
  input: WordSubmissionInput,
  principal: SubmissionPrincipal,
  key: string,
  requestHash: string,
  items: readonly ValidatedItem[],
) {
  const replay = await findSubmissionReplay(db, principal.agent.id, key, requestHash);
  if (replay !== null) return replay;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const pending = items.filter((item) => item.duplicateOf === null).length;
  const statements = [
    db
      .prepare(
        `INSERT INTO word_submission_batches
      (id, agent_id, game, idempotency_key, request_hash, created_at)
      SELECT ?, a.id, ?, ?, ?, ? FROM word_submission_agents a
      JOIN word_submission_credentials c ON c.agent_id = a.id
      JOIN word_submission_limits limits ON limits.id = 1 AND limits.accepting = 1
      LEFT JOIN word_submission_daily_usage usage ON usage.agent_id = a.id AND usage.day = ?
      WHERE a.id = ? AND a.status = 'active' AND c.id = ?
        AND c.revoked_at IS NULL AND c.expires_at > ?
        AND EXISTS (SELECT 1 FROM json_each(a.games_json) WHERE value = ?)
        AND COALESCE(usage.submitted_count, 0) + ? <= a.daily_quota
        AND a.pending_count + ? <= a.pending_quota
        AND limits.pending_count + ? <= ?
        AND (CASE WHEN limits.submission_day = ? THEN limits.submitted_today ELSE 0 END) + ? <= ?
      ON CONFLICT (agent_id, idempotency_key) DO NOTHING`,
      )
      .bind(
        id,
        input.game,
        key,
        requestHash,
        now,
        day,
        principal.agent.id,
        principal.credentialId,
        now,
        input.game,
        items.length,
        pending,
        pending,
        WORD_SUBMISSION_PENDING_LIMIT,
        day,
        items.length,
        WORD_SUBMISSION_DAILY_LIMIT,
      ),
    db
      .prepare(
        `INSERT INTO word_submission_daily_usage (agent_id, day, submitted_count)
      SELECT agent_id, ?, ? FROM word_submission_batches WHERE id = ?
      ON CONFLICT (agent_id, day) DO UPDATE SET submitted_count = submitted_count + excluded.submitted_count`,
      )
      .bind(day, items.length, id),
    db
      .prepare(
        `UPDATE word_submission_limits SET
      submitted_today = (CASE WHEN submission_day = ? THEN submitted_today ELSE 0 END) + ?,
      submission_day = ? WHERE id = 1 AND EXISTS (SELECT 1 FROM word_submission_batches WHERE id = ?)`,
      )
      .bind(day, items.length, day, id),
  ];
  for (const item of items) {
    statements.push(
      db
        .prepare(
          `INSERT INTO word_submission_items
      (id, batch_id, game, client_item_id, identity, content_hash, title, category,
       material_json, status, duplicate_of)
      SELECT ?, id, game, ?, ?, ?, ?, ?, ?,
        CASE WHEN ? IS NOT NULL OR EXISTS (SELECT 1 FROM word_submission_items
          WHERE game = ? AND content_hash = ? AND status <> 'duplicate')
          THEN 'duplicate' ELSE 'pending' END,
        CASE WHEN ? IS NOT NULL THEN ? WHEN EXISTS (SELECT 1 FROM word_submission_items
          WHERE game = ? AND content_hash = ? AND status <> 'duplicate')
          THEN 'previous-submission' ELSE NULL END
      FROM word_submission_batches WHERE id = ?`,
        )
        .bind(
          crypto.randomUUID(),
          item.clientItemId,
          item.identity,
          item.contentHash,
          item.title,
          item.category,
          JSON.stringify(item.content),
          item.duplicateOf,
          input.game,
          item.contentHash,
          item.duplicateOf,
          item.duplicateOf,
          input.game,
          item.contentHash,
          id,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO word_submission_search (rowid, game, agent, search_text, statuses)
    SELECT b.rowid, b.game, b.agent_id,
      b.id || ' ' || (SELECT group_concat(title, ' ') FROM word_submission_items WHERE batch_id = b.id),
      (SELECT group_concat(DISTINCT status) FROM word_submission_items WHERE batch_id = b.id)
    FROM word_submission_batches b WHERE b.id = ?`,
      )
      .bind(id),
  );
  const result = await db.batch(statements);
  if (result[0]?.meta.changes !== 1) {
    const concurrentReplay = await findSubmissionReplay(db, principal.agent.id, key, requestHash);
    if (concurrentReplay !== null) return concurrentReplay;
    const authorization = await db
      .prepare(
        `SELECT c.revoked_at, c.expires_at, a.status FROM word_submission_credentials c
      JOIN word_submission_agents a ON a.id = c.agent_id WHERE c.id = ?`,
      )
      .bind(principal.credentialId)
      .first<{
        revoked_at: string | null;
        expires_at: string;
        status: string;
      }>();
    if (
      authorization === null ||
      authorization.revoked_at !== null ||
      authorization.expires_at <= new Date().toISOString()
    )
      throw new HTTPException(401, { message: 'INVALID_SUBMISSION_TOKEN' });
    if (authorization.status !== 'active')
      throw new HTTPException(403, { message: 'SUBMISSION_AGENT_NOT_ACTIVE' });
    const settings = await db
      .prepare('SELECT accepting FROM word_submission_limits WHERE id = 1')
      .first<{ accepting: number }>();
    if (settings?.accepting === 0)
      throw new HTTPException(503, { message: 'WORD_SUBMISSIONS_PAUSED' });
    throw new HTTPException(429, { message: 'SUBMISSION_QUOTA_OR_CAPACITY_EXCEEDED' });
  }
  return readSubmissionBatch(db, id, principal.agent.id);
}
