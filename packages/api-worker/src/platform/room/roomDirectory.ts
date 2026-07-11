/** D1 room directory and explicit cross-storage saga state transitions. */

import { canonicalJson } from '@werewolf/game-engine/platform/protocol/canonicalJson';
import { parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';
import { randomIntInclusive } from '@werewolf/game-engine/utils/random';
import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';

import { createDb } from '../../db';
import { ROOM_DIRECTORY_STATUSES, ROOM_SAGA_OPERATIONS, rooms } from '../../db/schema';
import type { Env } from '../../env';

const PUBLIC_ROOM_CODE_MIN = 1000;
const PUBLIC_ROOM_CODE_MAX = 9999;
const ROOM_CODE_ALLOCATION_ATTEMPTS = 64;
const ROOM_SAGA_FAILURE_THRESHOLD = 5;
const ROOM_SAGA_RETRY_DELAY_MS = 5 * 60_000;

const SYSTEM_ROOM_EXPIRY_ACTOR = 'system:room-expiry';

export type RoomDirectoryRecord = typeof rooms.$inferSelect;

export interface ActiveRoomDirectoryEntry {
  readonly roomCode: string;
  readonly roomId: string;
  readonly gameType: RoomDirectoryRecord['gameType'];
  readonly hostUserId: string;
  readonly creationId: string;
  readonly createdAt: string;
}

export type ActiveRoomResolution =
  | { readonly kind: 'found'; readonly room: ActiveRoomDirectoryEntry }
  | { readonly kind: 'missing' }
  | { readonly kind: 'instanceMismatch' };

export interface RoomEffectDirectoryIdentity {
  readonly roomId: string;
  readonly roomCode: string;
  readonly creationId: string;
}

export interface ClaimRoomCreationInput {
  readonly gameType: RoomDirectoryRecord['gameType'];
  readonly hostUserId: string;
  readonly creationId: string;
  readonly configJson: string;
}

export type ClaimRoomCreationResult =
  | { readonly kind: 'claimed' | 'replay'; readonly room: RoomDirectoryRecord }
  | { readonly kind: 'conflict' };

function isoTimestamp(nowMs: number): string {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('Room directory time must be a non-negative safe integer');
  }
  return new Date(nowMs).toISOString();
}

function createPublicRoomCode(): string {
  return randomIntInclusive(PUBLIC_ROOM_CODE_MIN, PUBLIC_ROOM_CODE_MAX).toString();
}

function requireNonEmptyString(value: string, label: string): string {
  if (value.length === 0) throw new Error(`${label} must be non-empty`);
  return value;
}

function requireIsoTimestamp(value: string, label: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return value;
}

function requireNullableIsoTimestamp(value: string | null, label: string): string | null {
  return value === null ? null : requireIsoTimestamp(value, label);
}

function parseDirectoryConfig(configJson: string): string {
  requireNonEmptyString(configJson, 'rooms.config_json');
  const config: unknown = JSON.parse(configJson);
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('rooms.config_json must contain an object');
  }
  if (canonicalJson(config) !== configJson) {
    throw new Error('rooms.config_json must use canonical JSON encoding');
  }
  return configJson;
}

function parseRoomDirectoryRecord(env: Env, row: RoomDirectoryRecord): RoomDirectoryRecord {
  env.GAME_ROOM.idFromString(requireNonEmptyString(row.id, 'rooms.id'));
  const code = parseRoomCode(row.code);
  const gameType = parseGameType(row.gameType);
  const hostUserId = requireNonEmptyString(row.hostUserId, 'rooms.host_user_id');
  const creationId = requireNonEmptyString(row.creationId, 'rooms.creation_id');
  const configJson = parseDirectoryConfig(row.configJson);
  if (!ROOM_DIRECTORY_STATUSES.some((status) => status === row.status)) {
    throw new Error(`rooms.status is invalid: ${String(row.status)}`);
  }
  if (
    row.failureOperation !== null &&
    !ROOM_SAGA_OPERATIONS.some((operation) => operation === row.failureOperation)
  ) {
    throw new Error(`rooms.failure_operation is invalid: ${String(row.failureOperation)}`);
  }
  if (!Number.isSafeInteger(row.reconciliationAttemptCount) || row.reconciliationAttemptCount < 0) {
    throw new Error('rooms.reconciliation_attempt_count must be non-negative');
  }
  const reconcileAfter = requireNullableIsoTimestamp(row.reconcileAfter, 'rooms.reconcile_after');
  const createdAt = requireIsoTimestamp(row.createdAt, 'rooms.created_at');
  const updatedAt = requireIsoTimestamp(row.updatedAt, 'rooms.updated_at');
  const lastStartedAt = requireNullableIsoTimestamp(row.lastStartedAt, 'rooms.last_started_at');
  if (!Number.isSafeInteger(row.gamesStarted) || row.gamesStarted < 0) {
    throw new Error('rooms.games_started must be non-negative');
  }

  if (row.status === 'active') {
    if (
      row.failureOperation !== null ||
      row.lastError !== null ||
      row.reconciliationAttemptCount !== 0 ||
      reconcileAfter !== null ||
      row.deleteRequestedBy !== null
    ) {
      throw new Error('Active room has uncleared saga fields');
    }
  } else {
    if (reconcileAfter === null) throw new Error(`${row.status} room has no reconcile_after`);
    if (row.status === 'failed') {
      if (row.failureOperation === null || row.lastError === null || row.lastError.length === 0) {
        throw new Error('Failed room has incomplete failure metadata');
      }
    } else if (row.failureOperation !== null) {
      throw new Error(`${row.status} room cannot have failure_operation`);
    }
    if (row.status === 'creating' || row.failureOperation === 'create') {
      if (row.deleteRequestedBy !== null) {
        throw new Error('Create saga cannot have delete_requested_by');
      }
    } else {
      requireNonEmptyString(row.deleteRequestedBy ?? '', 'rooms.delete_requested_by');
    }
  }

  return {
    id: row.id,
    code,
    gameType,
    hostUserId,
    creationId,
    configJson,
    status: row.status,
    failureOperation: row.failureOperation,
    lastError: row.lastError,
    reconciliationAttemptCount: row.reconciliationAttemptCount,
    reconcileAfter,
    deleteRequestedBy: row.deleteRequestedBy,
    createdAt,
    updatedAt,
    gamesStarted: row.gamesStarted,
    lastStartedAt,
  };
}

function isExactCreation(room: RoomDirectoryRecord, input: ClaimRoomCreationInput): boolean {
  return (
    room.creationId === input.creationId &&
    room.gameType === input.gameType &&
    room.hostUserId === input.hostUserId &&
    room.configJson === input.configJson
  );
}

/** Allocate an immutable DO identity. Public room codes may be reused; this ID may not. */
function createRoomInstanceId(env: Env): string {
  return env.GAME_ROOM.newUniqueId().toString();
}

export async function findRoomByCode(
  env: Env,
  roomCode: string,
): Promise<RoomDirectoryRecord | null> {
  const row = await createDb(env.DB).select().from(rooms).where(eq(rooms.code, roomCode)).get();
  return row === undefined ? null : parseRoomDirectoryRecord(env, row);
}

export async function findRoomByCreationId(
  env: Env,
  creationId: string,
): Promise<RoomDirectoryRecord | null> {
  const row = await createDb(env.DB)
    .select()
    .from(rooms)
    .where(eq(rooms.creationId, creationId))
    .get();
  return row === undefined ? null : parseRoomDirectoryRecord(env, row);
}

/** Resolve only active rooms; in-flight saga rows are unavailable to public traffic. */
export async function findActiveRoom(
  env: Env,
  roomCode: string,
): Promise<ActiveRoomDirectoryEntry | null> {
  const row = await createDb(env.DB)
    .select()
    .from(rooms)
    .where(and(eq(rooms.code, roomCode), eq(rooms.status, 'active')))
    .get();
  if (row === undefined) return null;
  const parsed = parseRoomDirectoryRecord(env, row);
  return {
    roomCode: parsed.code,
    roomId: parsed.id,
    gameType: parsed.gameType,
    hostUserId: parsed.hostUserId,
    creationId: parsed.creationId,
    createdAt: parsed.createdAt,
  };
}

export async function resolveActiveRoom(
  env: Env,
  roomCode: string,
  roomId: string,
): Promise<ActiveRoomResolution> {
  const current = await findActiveRoom(env, roomCode);
  if (current === null) return { kind: 'missing' };
  return current.roomId === roomId
    ? { kind: 'found', room: current }
    : { kind: 'instanceMismatch' };
}

/** Effects may finish during deletion, but can never cross an immutable room instance. */
export async function assertRoomEffectDirectory(
  env: Env,
  identity: RoomEffectDirectoryIdentity,
): Promise<RoomDirectoryRecord> {
  const room = await findRoomByCode(env, identity.roomCode);
  if (room === null || room.id !== identity.roomId || room.creationId !== identity.creationId) {
    throw new Error(`Room effect directory identity is stale for ${identity.roomCode}`);
  }
  if (
    room.status !== 'active' &&
    room.status !== 'deleting' &&
    !(room.status === 'failed' && room.failureOperation === 'delete')
  ) {
    throw new Error(`Room effect cannot run while directory status is ${room.status}`);
  }
  return room;
}

/** Claim one creation identity, retrying only server-generated room-code collisions. */
export async function claimRoomCreation(
  env: Env,
  input: ClaimRoomCreationInput,
  nowMs: number,
): Promise<ClaimRoomCreationResult> {
  const existing = await findRoomByCreationId(env, input.creationId);
  if (existing !== null) {
    return isExactCreation(existing, input)
      ? { kind: 'replay', room: existing }
      : { kind: 'conflict' };
  }

  const timestamp = isoTimestamp(nowMs);
  const db = createDb(env.DB);
  for (let attempt = 0; attempt < ROOM_CODE_ALLOCATION_ATTEMPTS; attempt += 1) {
    const roomCode = createPublicRoomCode();
    const inserted = await db
      .insert(rooms)
      .values({
        id: createRoomInstanceId(env),
        code: roomCode,
        gameType: input.gameType,
        hostUserId: input.hostUserId,
        creationId: input.creationId,
        configJson: input.configJson,
        status: 'creating',
        failureOperation: null,
        lastError: null,
        reconciliationAttemptCount: 0,
        reconcileAfter: timestamp,
        deleteRequestedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing()
      .returning();
    const claimed = inserted[0];
    if (claimed !== undefined) {
      return { kind: 'claimed', room: parseRoomDirectoryRecord(env, claimed) };
    }

    const concurrent = await findRoomByCreationId(env, input.creationId);
    if (concurrent !== null) {
      return isExactCreation(concurrent, input)
        ? { kind: 'replay', room: concurrent }
        : { kind: 'conflict' };
    }
  }

  throw new Error(`Room code allocation exhausted after ${ROOM_CODE_ALLOCATION_ATTEMPTS} attempts`);
}

export async function activateRoomCreation(
  env: Env,
  room: RoomDirectoryRecord,
  nowMs: number,
): Promise<RoomDirectoryRecord> {
  const activated = await createDb(env.DB)
    .update(rooms)
    .set({
      status: 'active',
      failureOperation: null,
      lastError: null,
      reconciliationAttemptCount: 0,
      reconcileAfter: null,
      updatedAt: isoTimestamp(nowMs),
    })
    .where(
      and(
        eq(rooms.id, room.id),
        eq(rooms.creationId, room.creationId),
        or(eq(rooms.status, 'creating'), eq(rooms.status, 'failed')),
        or(eq(rooms.failureOperation, 'create'), sql`${rooms.failureOperation} IS NULL`),
      ),
    )
    .returning();
  const row = activated[0];
  if (row !== undefined) return parseRoomDirectoryRecord(env, row);

  const current = await findRoomByCreationId(env, room.creationId);
  if (current !== null && current.id === room.id && current.status === 'active') return current;
  throw new Error(`Room ${room.code} could not transition to active`);
}

export async function beginRoomDeletion(
  env: Env,
  room: RoomDirectoryRecord,
  requestedBy: string,
  nowMs: number,
): Promise<RoomDirectoryRecord> {
  if (requestedBy.length === 0) throw new Error('Room deletion actor must be non-empty');
  const deleting = await createDb(env.DB)
    .update(rooms)
    .set({
      status: 'deleting',
      failureOperation: null,
      lastError: null,
      reconciliationAttemptCount: 0,
      reconcileAfter: isoTimestamp(nowMs),
      deleteRequestedBy: requestedBy,
      updatedAt: isoTimestamp(nowMs),
    })
    .where(and(eq(rooms.id, room.id), eq(rooms.status, 'active')))
    .returning();
  const row = deleting[0];
  if (row !== undefined) return parseRoomDirectoryRecord(env, row);

  const current = await findRoomByCreationId(env, room.creationId);
  if (
    current !== null &&
    current.id === room.id &&
    (current.status === 'deleting' ||
      (current.status === 'failed' && current.failureOperation === 'delete'))
  ) {
    return current;
  }
  throw new Error(`Room ${room.code} could not transition to deleting`);
}

export async function recordRoomSagaFailure(
  env: Env,
  room: RoomDirectoryRecord,
  operation: 'create' | 'delete',
  error: Error,
  nowMs: number,
): Promise<void> {
  const retryAt = isoTimestamp(nowMs + ROOM_SAGA_RETRY_DELAY_MS);
  const expectedStatus = operation === 'create' ? 'creating' : 'deleting';
  const updated = await createDb(env.DB)
    .update(rooms)
    .set({
      status: sql`CASE
        WHEN ${rooms.status} = 'failed'
          OR ${rooms.reconciliationAttemptCount} + 1 >= ${ROOM_SAGA_FAILURE_THRESHOLD}
        THEN 'failed'
        ELSE ${expectedStatus}
      END`,
      failureOperation: sql`CASE
        WHEN ${rooms.status} = 'failed'
          OR ${rooms.reconciliationAttemptCount} + 1 >= ${ROOM_SAGA_FAILURE_THRESHOLD}
        THEN ${operation}
        ELSE NULL
      END`,
      lastError: error.message,
      reconciliationAttemptCount: sql`${rooms.reconciliationAttemptCount} + 1`,
      reconcileAfter: retryAt,
      updatedAt: isoTimestamp(nowMs),
    })
    .where(
      and(
        eq(rooms.id, room.id),
        or(
          eq(rooms.status, expectedStatus),
          and(eq(rooms.status, 'failed'), eq(rooms.failureOperation, operation)),
        ),
      ),
    )
    .returning({ id: rooms.id });
  if (updated.length !== 1) {
    throw new Error(`Room ${room.code} saga failure could not be recorded`);
  }
}

export async function deleteRoomDirectoryEntry(env: Env, room: RoomDirectoryRecord): Promise<void> {
  const deleted = await createDb(env.DB)
    .delete(rooms)
    .where(
      and(
        eq(rooms.id, room.id),
        eq(rooms.creationId, room.creationId),
        or(
          eq(rooms.status, 'deleting'),
          and(eq(rooms.status, 'failed'), eq(rooms.failureOperation, 'delete')),
        ),
      ),
    )
    .returning({ id: rooms.id });
  if (deleted.length === 1) return;

  const current = await findRoomByCreationId(env, room.creationId);
  if (current === null) return;
  throw new Error(`Room ${room.code} directory entry is not deletable`);
}

export async function listRoomsForReconciliation(
  env: Env,
  nowMs: number,
  limit: number,
): Promise<readonly RoomDirectoryRecord[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Room reconciliation limit must be a positive safe integer');
  }
  const now = isoTimestamp(nowMs);
  const rows = await createDb(env.DB)
    .select()
    .from(rooms)
    .where(
      and(
        inArray(rooms.status, ['creating', 'deleting', 'failed']),
        or(lte(rooms.reconcileAfter, now), sql`${rooms.reconcileAfter} IS NULL`),
      ),
    )
    .orderBy(rooms.updatedAt)
    .limit(limit);
  return rows.map((row) => parseRoomDirectoryRecord(env, row));
}

export async function markExpiredRoomsDeleting(
  env: Env,
  cutoffMs: number,
  nowMs: number,
  limit: number,
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Room expiry limit must be a positive safe integer');
  }
  const db = createDb(env.DB);
  const candidates = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.status, 'active'), lte(rooms.createdAt, isoTimestamp(cutoffMs))))
    .orderBy(rooms.createdAt)
    .limit(limit);
  if (candidates.length === 0) return 0;

  const marked = await db
    .update(rooms)
    .set({
      status: 'deleting',
      failureOperation: null,
      lastError: null,
      reconciliationAttemptCount: 0,
      reconcileAfter: isoTimestamp(nowMs),
      deleteRequestedBy: SYSTEM_ROOM_EXPIRY_ACTOR,
      updatedAt: isoTimestamp(nowMs),
    })
    .where(
      and(
        eq(rooms.status, 'active'),
        inArray(
          rooms.id,
          candidates.map(({ id }) => id),
        ),
      ),
    )
    .returning({ id: rooms.id });
  return marked.length;
}
