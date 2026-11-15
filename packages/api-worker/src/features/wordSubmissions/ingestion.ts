/** Strict validation, agent-scoped idempotency, and atomic submission quotas. No model calls. */
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import {
  type GameWordGame,
  WORD_SUBMISSION_DAILY_LIMIT,
  WORD_SUBMISSION_PENDING_LIMIT,
  WORD_SUBMISSION_SCHEMA_VERSION,
  type WordSubmissionBatch,
  type WordSubmissionInput,
  type WordSubmissionValidation,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

import { WORKER_WORD_SUBMISSION_ADAPTERS } from '../../games/catalog';
import { AiOutputValidationError } from '../../platform/ai/aiError';
import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type {
  SubmissionMaterial,
  WordSupplySubmissionItem,
} from '../../platform/wordSupply/submissionAdapter';
import { readSubmissionAgent, type SubmissionPrincipal } from './credentials';
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
        `SELECT DISTINCT identity AS key FROM word_submission_items
      WHERE game = ? AND identity IN (SELECT value FROM json_each(?)) AND status <> 'duplicate'`,
      )
      .bind(input.game, JSON.stringify(items.map((item) => item.identity))),
    db
      .prepare(
        `SELECT item.identity AS key
      FROM (SELECT value AS identity FROM json_each(?)) item WHERE ${adapter.inventoryExistsSql}`,
      )
      .bind(JSON.stringify(items.map((item) => item.identity))),
  ]);
  const [previous, previousIdentities, inventory] = matches;
  if (previous === undefined || previousIdentities === undefined || inventory === undefined)
    throw new Error('Submission validation query results missing');
  const previousHashes = new Set(previous.results.map((row) => row.key));
  const previousIdentitySet = new Set(previousIdentities.results.map((row) => row.key));
  const inventoryIdentities = new Set(inventory.results.map((row) => row.key));
  const seenHashes = new Map<string, string>();
  const seenIdentities = new Map<string, string>();
  const validated = items.map((item) => {
    const duplicateOf = inventoryIdentities.has(item.identity)
      ? `inventory:${item.identity}`
      : previousIdentitySet.has(item.identity)
        ? 'previous-submission'
        : previousHashes.has(item.contentHash)
          ? 'previous-submission'
          : (seenHashes.get(item.contentHash) ?? seenIdentities.get(item.identity) ?? null);
    seenHashes.set(item.contentHash, item.clientItemId);
    seenIdentities.set(item.identity, item.clientItemId);
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

/** All quota claims, batch data, and queue counters commit or roll back together.
 * A caller may fix the batch id (supply reuses its run UUID); otherwise a
 * fresh UUID is generated, as for external submissions. */
export async function storeSubmission(
  db: D1Database,
  input: WordSubmissionInput,
  principal: SubmissionPrincipal,
  key: string,
  requestHash: string,
  items: readonly ValidatedItem[],
  batchId?: string,
) {
  const replay = await findSubmissionReplay(db, principal.agent.id, key, requestHash);
  if (replay !== null) return replay;
  const id = batchId ?? crypto.randomUUID();
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
          WHERE game = ? AND identity = ? AND status <> 'duplicate')
          OR EXISTS (SELECT 1 FROM word_submission_items
          WHERE game = ? AND content_hash = ? AND status <> 'duplicate')
          THEN 'duplicate' ELSE 'pending' END,
        CASE WHEN ? IS NOT NULL THEN ? WHEN EXISTS (SELECT 1 FROM word_submission_items
          WHERE game = ? AND identity = ? AND status <> 'duplicate')
          THEN 'previous-submission' WHEN EXISTS (SELECT 1 FROM word_submission_items
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
          item.identity,
          input.game,
          item.contentHash,
          item.duplicateOf,
          item.duplicateOf,
          input.game,
          item.identity,
          input.game,
          item.contentHash,
          id,
        ),
    );
  }
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

/** Supply-produced words enter the submission flow directly: one batch per
 * supply run, owned by the system agent, reviewed and published exactly like
 * agent submissions. The candidate tables are never written. */

/** Fixed system-agent id (a real UUID: the agent schema requires one). */
export const SUPPLY_AGENT_ID = '00000000-0000-4000-8000-000000000001';
export const SUPPLY_AGENT_NAME = '系统补词';
/** Fixed system-credential id; the token behind its hash is never issued. */
const SUPPLY_CREDENTIAL_ID = '00000000-0000-4000-8000-000000000002';
/** The system credential is never issued to anyone, so its expiry is nominal. */
const SUPPLY_CREDENTIAL_EXPIRES_AT = '2999-01-01T00:00:00.000Z';

/** Create the system agent and its (never issued) credential on first use. */
async function ensureSupplyAgent(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO word_submission_agents
      (id, name, description, games_json, status, daily_quota, pending_quota,
       current_credential_id, created_at)
      VALUES (?, ?, ?, ?, 'active', 1000, 1000, ?, ?)`,
      )
      .bind(
        SUPPLY_AGENT_ID,
        SUPPLY_AGENT_NAME,
        '补词 workflow 生成的投稿',
        JSON.stringify(['fibking', 'undercover', 'drawguess']),
        SUPPLY_CREDENTIAL_ID,
        now,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO word_submission_credentials
      (id, agent_id, token_hash, prefix, expires_at, created_at)
      VALUES (?, ?, ?, 'supply', ?, ?)`,
      )
      .bind(
        SUPPLY_CREDENTIAL_ID,
        SUPPLY_AGENT_ID,
        await sha256Hex(crypto.randomUUID()),
        SUPPLY_CREDENTIAL_EXPIRES_AT,
        now,
      ),
  ]);
}

/** Store generated candidates as pending submission items. An item the
 * submission schema rejects is a generation bug: fail loudly instead of
 * silently dropping it. Duplicates are stored as 'duplicate' by the same
 * rules as agent submissions and do not enter review. */
export async function storeSupplySubmissions(
  db: D1Database,
  game: GameWordGame,
  batchId: string,
  items: readonly WordSupplySubmissionItem[],
): Promise<WordSubmissionBatch> {
  await ensureSupplyAgent(db);
  const agent = await readSubmissionAgent(db, SUPPLY_AGENT_ID);
  if (agent.credential === null) throw new Error('Supply agent has no credential');
  const principal: SubmissionPrincipal = { agent, credentialId: agent.credential.id };
  const input: WordSubmissionInput = {
    schemaVersion: WORD_SUBMISSION_SCHEMA_VERSION,
    game,
    items: items.map((item) => ({ clientItemId: item.clientItemId, content: item.content })),
  };
  const result = await validateSubmission(db, input, principal);
  const invalid = result.validation.items.filter((item) => item.status === 'invalid');
  if (invalid.length > 0)
    throw new Error(
      `Supply submission failed validation: ${invalid
        .map((item) => `${item.clientItemId}: ${item.reason ?? 'invalid'}`)
        .join('; ')}`,
    );
  const requestHash = await sha256Hex(canonicalJson(input));
  return storeSubmission(db, input, principal, batchId, requestHash, result.items, batchId);
}
