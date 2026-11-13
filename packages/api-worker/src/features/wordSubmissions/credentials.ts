/** Revocable, expiring agent credentials; raw tokens exist only in the issuance response. */
import {
  type WordSubmissionAgent,
  type WordSubmissionAgentInput,
  wordSubmissionAgentSchema,
  type WordSubmissionAgentUpdate,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';

const agentSelect = `SELECT a.id, a.name, a.description, a.games_json, a.status,
  a.daily_quota AS dailyQuota, a.pending_quota AS pendingQuota,
  a.pending_count AS pending, a.created_at AS createdAt,
  COALESCE(u.submitted_count, 0) AS submittedToday,
  CASE WHEN c.id IS NULL THEN NULL ELSE json_object(
    'id', c.id, 'prefix', c.prefix, 'expiresAt', c.expires_at, 'revokedAt', c.revoked_at
  ) END AS credential_json
  FROM word_submission_agents a
  LEFT JOIN word_submission_credentials c ON c.id = a.current_credential_id
  LEFT JOIN word_submission_daily_usage u ON u.agent_id = a.id AND u.day = ?`;

function decodeAgent(value: Record<string, unknown>): WordSubmissionAgent {
  const { games_json, credential_json, ...agent } = value;
  const games: unknown = JSON.parse(z.string().parse(games_json));
  const credential: unknown =
    credential_json === null ? null : JSON.parse(z.string().parse(credential_json));
  return wordSubmissionAgentSchema.parse({
    ...agent,
    games,
    credential,
  });
}

/** Return metadata only; hashes and raw credentials are excluded from all reads. */
async function readSubmissionAgent(db: D1Database, id: string): Promise<WordSubmissionAgent> {
  const row = await db
    .prepare(`${agentSelect} WHERE a.id = ? AND a.deleted_at IS NULL`)
    .bind(new Date().toISOString().slice(0, 10), id)
    .first<Record<string, unknown>>();
  if (row === null) throw new HTTPException(404, { message: 'SUBMISSION_AGENT_NOT_FOUND' });
  return decodeAgent(row);
}

/** The agent registry has a hard capacity of 100; this read is consequently bounded. */
export async function listSubmissionAgents(db: D1Database): Promise<WordSubmissionAgent[]> {
  const rows = await db
    .prepare(
      `${agentSelect} WHERE a.deleted_at IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT 100`,
    )
    .bind(new Date().toISOString().slice(0, 10))
    .all();
  return rows.results.map(decodeAgent);
}

async function newCredential(agentId: string, days: number, now: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `wst_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  return {
    id: crypto.randomUUID(),
    agentId,
    token,
    hash: await sha256Hex(token),
    prefix: token.slice(0, 12),
    now,
    expiresAt: new Date(Date.parse(now) + days * 86_400_000).toISOString(),
  };
}

function credentialInsert(db: D1Database, credential: Awaited<ReturnType<typeof newCredential>>) {
  return db
    .prepare(
      `INSERT INTO word_submission_credentials
    (id, agent_id, token_hash, prefix, expires_at, created_at)
    SELECT ?, id, ?, ?, ?, ? FROM word_submission_agents WHERE id = ?`,
    )
    .bind(
      credential.id,
      credential.hash,
      credential.prefix,
      credential.expiresAt,
      credential.now,
      credential.agentId,
    );
}

/** Create one bounded principal and its first credential in a single transaction. */
export async function createSubmissionAgent(db: D1Database, input: WordSubmissionAgentInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const credential = await newCredential(id, input.expiresInDays, now);
  const result = await db.batch([
    db
      .prepare(
        `INSERT INTO word_submission_agents
      (id, name, description, games_json, status, daily_quota, pending_quota, created_at, current_credential_id)
      SELECT ?, ?, ?, ?, 'active', ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM word_submission_agents WHERE deleted_at IS NULL LIMIT 1 OFFSET 99) RETURNING id`,
      )
      .bind(
        id,
        input.name,
        input.description,
        JSON.stringify([...new Set(input.games)]),
        input.dailyQuota,
        input.pendingQuota,
        now,
        credential.id,
      ),
    credentialInsert(db, credential),
  ]);
  if (result[0]?.results.length !== 1)
    throw new HTTPException(409, { message: 'SUBMISSION_AGENT_CAPACITY_REACHED' });
  return { agent: await readSubmissionAgent(db, id), token: credential.token };
}

/** Update the existing principal without issuing a key or resetting its usage counters. */
export async function updateSubmissionAgent(
  db: D1Database,
  id: string,
  input: WordSubmissionAgentUpdate,
) {
  const agent = await readSubmissionAgent(db, id);
  if (agent.status === 'revoked')
    throw new HTTPException(409, { message: 'SUBMISSION_AGENT_REVOKED' });
  if (input.pendingQuota < agent.pending)
    throw new HTTPException(409, { message: 'SUBMISSION_PENDING_QUOTA_BELOW_CURRENT_USAGE' });
  const statements = [
    db
      .prepare(
        `UPDATE word_submission_agents SET name = ?, description = ?, games_json = ?,
      daily_quota = ?, pending_quota = ?
      WHERE id = ? AND status <> 'revoked' AND deleted_at IS NULL AND pending_count <= ? RETURNING id`,
      )
      .bind(
        input.name,
        input.description,
        JSON.stringify([...new Set(input.games)]),
        input.dailyQuota,
        input.pendingQuota,
        id,
        input.pendingQuota,
      ),
  ];
  if (input.expiresInDays !== undefined) {
    statements.push(
      db
        .prepare(
          `UPDATE word_submission_credentials SET expires_at = ?
      WHERE id = (SELECT current_credential_id FROM word_submission_agents
        WHERE id = ? AND status <> 'revoked' AND deleted_at IS NULL AND pending_count <= ?)
        AND revoked_at IS NULL`,
        )
        .bind(
          new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
          id,
          input.pendingQuota,
        ),
    );
  }
  const result = await db.batch(statements);
  if (result[0]?.results.length !== 1)
    throw new HTTPException(409, { message: 'SUBMISSION_AGENT_NOT_MUTABLE_OR_QUOTA_TOO_LOW' });
  return readSubmissionAgent(db, id);
}

/** Hide only revoked authorizations; foreign-key provenance and usage records remain intact. */
export async function deleteSubmissionAgent(db: D1Database, id: string) {
  const row = await db
    .prepare(
      `UPDATE word_submission_agents SET deleted_at = COALESCE(deleted_at, ?)
    WHERE id = ? AND status = 'revoked' RETURNING id`,
    )
    .bind(new Date().toISOString(), id)
    .first();
  if (row === null) throw new HTTPException(409, { message: 'SUBMISSION_AGENT_MUST_BE_REVOKED' });
  return { success: true } as const;
}

/** Replacement invalidates all prior keys without replacing the principal or its quotas. */
export async function rotateSubmissionCredential(db: D1Database, id: string, days: number) {
  const agent = await readSubmissionAgent(db, id);
  if (agent.status === 'revoked')
    throw new HTTPException(409, { message: 'SUBMISSION_AGENT_REVOKED' });
  const credential = await newCredential(id, days, new Date().toISOString());
  await db.batch([
    db
      .prepare(
        `UPDATE word_submission_credentials SET revoked_at = ?
      WHERE agent_id = ? AND revoked_at IS NULL`,
      )
      .bind(credential.now, id),
    credentialInsert(db, credential),
    db
      .prepare('UPDATE word_submission_agents SET current_credential_id = ? WHERE id = ?')
      .bind(credential.id, id),
  ]);
  return { agent: await readSubmissionAgent(db, id), token: credential.token };
}

/** Revocation is permanent; pausing is reversible and does not erase pending work. */
export async function setSubmissionAgentStatus(
  db: D1Database,
  id: string,
  status: WordSubmissionAgent['status'],
) {
  const result = await db
    .prepare(
      `UPDATE word_submission_agents SET status = ?
    WHERE id = ? AND status <> 'revoked' AND deleted_at IS NULL RETURNING id`,
    )
    .bind(status, id)
    .first();
  if (result === null) throw new HTTPException(409, { message: 'SUBMISSION_AGENT_NOT_MUTABLE' });
  return readSubmissionAgent(db, id);
}

export interface SubmissionPrincipal {
  readonly agent: WordSubmissionAgent;
  readonly credentialId: string;
}

/** Hash lookup authenticates a key; an administrator password is never accepted here. */
export async function authenticateSubmissionToken(
  db: D1Database,
  authorization: string | undefined,
): Promise<SubmissionPrincipal> {
  if (authorization === undefined || !/^Bearer wst_[a-f0-9]{64}$/.test(authorization))
    throw new HTTPException(401, { message: 'SUBMISSION_TOKEN_REQUIRED' });
  const tokenHash = await sha256Hex(authorization.slice('Bearer '.length));
  const credential = await db
    .prepare(
      `SELECT id, agent_id FROM word_submission_credentials
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
      AND EXISTS (SELECT 1 FROM word_submission_agents a
        WHERE a.id = word_submission_credentials.agent_id AND a.deleted_at IS NULL)`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<{ id: string; agent_id: string }>();
  if (credential === null) throw new HTTPException(401, { message: 'INVALID_SUBMISSION_TOKEN' });
  const agent = await readSubmissionAgent(db, credential.agent_id);
  if (agent.status !== 'active')
    throw new HTTPException(403, { message: 'SUBMISSION_AGENT_NOT_ACTIVE' });
  return { agent, credentialId: credential.id };
}
