/** Durable Object SQLite schema and one-way room storage migration. */

import {
  createWerewolfGameEndedEffect,
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_VERSION,
} from '@werewolf/game-engine/games/werewolf/public';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

const ROOM_STORAGE_SCHEMA_VERSION = 1;
const PREVIOUS_SETTLEMENT_KEY = 'settle_pending';

const TARGET_ROOM_STATE_COLUMNS = [
  'id',
  'creation_id',
  'initialization_json',
  'game_type',
  'state_version',
  'game_state',
  'revision',
  'created_at',
  'updated_at',
] as const;

const COMMAND_RECEIPT_COLUMNS = [
  'command_id',
  'game_type',
  'state_version',
  'actor_kind',
  'actor_id',
  'controlled_seat',
  'command_type',
  'request_json',
  'random_seed',
  'decision_kind',
  'revision',
  'result_json',
  'created_at',
  'expires_at',
] as const;

const EFFECT_OUTBOX_COLUMNS = [
  'id',
  'origin_command_id',
  'scope',
  'game_type',
  'effect_type',
  'business_key',
  'payload_json',
  'status',
  'attempt_count',
  'available_at',
  'created_revision',
  'created_at',
  'last_error',
] as const;

const PREVIOUS_ROOM_STATE_COLUMNS = ['id', 'game_state', 'revision'] as const;

const CREATE_ROOM_STATE_SQL = `
  CREATE TABLE room_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    creation_id TEXT NOT NULL UNIQUE CHECK (length(creation_id) BETWEEN 1 AND 128),
    initialization_json TEXT NOT NULL
      CHECK (json_valid(initialization_json) AND json_type(initialization_json) = 'object'),
    game_type TEXT NOT NULL CHECK (length(game_type) > 0),
    state_version INTEGER NOT NULL CHECK (state_version > 0),
    game_state TEXT NOT NULL
      CHECK (json_valid(game_state) AND json_type(game_state) = 'object'),
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
  ) STRICT
`;

interface PreviousRoomRow {
  readonly game_state: unknown;
  readonly revision: unknown;
}

interface PreviousSettlement {
  readonly revision: number;
  readonly attempt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatParsedJsonValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? typeof value : serialized;
}

function parsePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function readColumnNames(sql: SqlStorage, table: string): string[] {
  const rows = sql.exec<{ name: unknown }>(`PRAGMA table_info(${table})`).toArray();
  return rows.map((row, index) => {
    if (typeof row.name !== 'string') {
      throw new Error(`${table} column ${index} has an invalid name`);
    }
    return row.name;
  });
}

function hasExactColumns(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((column) => actual.includes(column));
}

function assertExactColumns(sql: SqlStorage, table: string, expected: readonly string[]): void {
  const actual = readColumnNames(sql, table);
  if (!hasExactColumns(actual, expected)) {
    throw new Error(`Unsupported ${table} schema: ${actual.join(',')}`);
  }
}

function createSupportingTables(sql: SqlStorage): void {
  sql.exec(`
    CREATE TABLE command_receipts (
      command_id TEXT PRIMARY KEY CHECK (length(command_id) BETWEEN 1 AND 200),
      game_type TEXT NOT NULL CHECK (length(game_type) > 0),
      state_version INTEGER NOT NULL CHECK (state_version > 0),
      actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
      actor_id TEXT NOT NULL CHECK (length(actor_id) > 0),
      controlled_seat INTEGER,
      command_type TEXT NOT NULL CHECK (length(command_type) > 0),
      request_json TEXT NOT NULL CHECK (json_valid(request_json)),
      random_seed TEXT NOT NULL CHECK (length(random_seed) > 0),
      decision_kind TEXT NOT NULL CHECK (decision_kind IN ('committed', 'rejected')),
      revision INTEGER NOT NULL CHECK (revision > 0),
      result_json TEXT NOT NULL CHECK (json_valid(result_json)),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
      CHECK (
        controlled_seat IS NULL OR
        (actor_kind = 'user' AND controlled_seat >= 0)
      )
    ) STRICT;
    CREATE INDEX command_receipts_expiry_idx
      ON command_receipts(expires_at, command_id);

    CREATE TABLE effect_outbox (
      id TEXT PRIMARY KEY CHECK (length(id) > 0),
      origin_command_id TEXT NOT NULL CHECK (length(origin_command_id) > 0),
      scope TEXT NOT NULL CHECK (scope IN ('platform', 'game')),
      game_type TEXT NOT NULL CHECK (length(game_type) > 0),
      effect_type TEXT NOT NULL CHECK (length(effect_type) > 0),
      business_key TEXT NOT NULL CHECK (length(business_key) > 0),
      payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
      status TEXT NOT NULL CHECK (status IN ('pending', 'failed')),
      attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
      available_at INTEGER NOT NULL CHECK (available_at >= 0),
      created_revision INTEGER NOT NULL CHECK (created_revision > 0),
      created_at INTEGER NOT NULL CHECK (created_at >= 0),
      last_error TEXT,
      UNIQUE (scope, game_type, effect_type, business_key)
    ) STRICT;
    CREATE INDEX effect_outbox_pending_idx
      ON effect_outbox(available_at, created_at, id)
      WHERE status = 'pending';
  `);
}

function createFreshSchema(sql: SqlStorage): void {
  sql.exec(CREATE_ROOM_STATE_SQL);
  createSupportingTables(sql);
}

function parsePreviousRoomRow(sql: SqlStorage): {
  readonly state: GameState;
  readonly stateJson: string;
  readonly revision: number;
} | null {
  const rows = sql
    .exec<PreviousRoomRow>('SELECT game_state, revision FROM room_state WHERE id = 1')
    .toArray();
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error(`Previous room_state contains ${rows.length} authoritative rows`);
  }

  const row = rows[0];
  if (typeof row.game_state !== 'string') {
    throw new Error('Previous room_state.game_state must be JSON text');
  }
  const parsedJson: unknown = JSON.parse(row.game_state);
  if (!isRecord(parsedJson)) {
    throw new Error('Previous room_state.game_state must contain a JSON object');
  }
  if (parsedJson.gameType !== undefined && parsedJson.gameType !== 'werewolf') {
    throw new Error(
      `Unsupported previous game type: ${formatParsedJsonValue(parsedJson.gameType)}`,
    );
  }
  if (parsedJson.stateVersion !== undefined && parsedJson.stateVersion !== WEREWOLF_STATE_VERSION) {
    throw new Error(
      `Unsupported previous state version: ${formatParsedJsonValue(parsedJson.stateVersion)}`,
    );
  }

  const state = WEREWOLF_STATE_CODEC.parse({
    ...parsedJson,
    gameType: 'werewolf',
    stateVersion: WEREWOLF_STATE_VERSION,
  });
  return {
    state,
    stateJson: JSON.stringify(state),
    revision: parsePositiveInteger(row.revision, 'Previous room_state.revision'),
  };
}

function migratePreviousRoomState(sql: SqlStorage, migratedAt: number): void {
  const previous = parsePreviousRoomRow(sql);
  sql.exec('ALTER TABLE room_state RENAME TO room_state_previous');
  sql.exec(CREATE_ROOM_STATE_SQL);

  if (previous !== null) {
    const creationId = `migration:${previous.state.roomCode}`;
    const initializationJson = JSON.stringify({
      roomCode: previous.state.roomCode,
      gameType: 'werewolf',
      hostUserId: previous.state.hostUserId,
      config: {
        templateRoles: previous.state.templateRoles,
        ...(previous.state.rules === undefined ? {} : { rules: previous.state.rules }),
      },
      creationId,
    });
    sql.exec(
      `INSERT INTO room_state (
        id,
        creation_id,
        initialization_json,
        game_type,
        state_version,
        game_state,
        revision,
        created_at,
        updated_at
      ) VALUES (1, ?, ?, 'werewolf', ?, ?, ?, ?, ?)`,
      creationId,
      initializationJson,
      WEREWOLF_STATE_VERSION,
      previous.stateJson,
      previous.revision,
      migratedAt,
      migratedAt,
    );
  }

  sql.exec('DROP TABLE room_state_previous');
  createSupportingTables(sql);
}

function parsePreviousSettlement(value: unknown): PreviousSettlement {
  if (!isRecord(value)) {
    throw new Error(`${PREVIOUS_SETTLEMENT_KEY} must be an object`);
  }
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('revision') || !keys.includes('attempt')) {
    throw new Error(`${PREVIOUS_SETTLEMENT_KEY} has unsupported fields`);
  }
  const attempt = value.attempt;
  if (typeof attempt !== 'number' || !Number.isSafeInteger(attempt) || attempt < 0) {
    throw new Error(`${PREVIOUS_SETTLEMENT_KEY}.attempt must be a non-negative integer`);
  }
  return {
    revision: parsePositiveInteger(value.revision, `${PREVIOUS_SETTLEMENT_KEY}.revision`),
    attempt,
  };
}

function readMigratedRoom(sql: SqlStorage): {
  readonly state: GameState;
  readonly revision: number;
} | null {
  const rows = sql
    .exec<{
      game_state: unknown;
      revision: unknown;
    }>('SELECT game_state, revision FROM room_state WHERE id = 1')
    .toArray();
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error(`room_state contains ${rows.length} rows`);
  const row = rows[0];
  if (typeof row.game_state !== 'string') {
    throw new Error('room_state.game_state must be JSON text');
  }
  return {
    state: WEREWOLF_STATE_CODEC.parse(JSON.parse(row.game_state)),
    revision: parsePositiveInteger(row.revision, 'room_state.revision'),
  };
}

function insertPreviousSettlementEffect(
  sql: SqlStorage,
  pending: PreviousSettlement,
  nowMs: number,
): boolean {
  const room = readMigratedRoom(sql);
  if (room === null) {
    throw new Error(`${PREVIOUS_SETTLEMENT_KEY} exists without room state`);
  }
  if (room.revision !== pending.revision || room.state.status !== GameStatus.Ended) {
    return false;
  }

  const effect = createWerewolfGameEndedEffect(room.state);
  const effectId = `migration:${room.state.roomCode}:${room.revision}:settlement`;
  sql.exec(
    `INSERT INTO effect_outbox (
      id,
      origin_command_id,
      scope,
      game_type,
      effect_type,
      business_key,
      payload_json,
      status,
      attempt_count,
      available_at,
      created_revision,
      created_at
    ) VALUES (?, ?, 'game', 'werewolf', ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    effectId,
    effectId,
    effect.type,
    `${room.state.roomCode}:${room.revision}`,
    JSON.stringify(effect),
    pending.attempt,
    nowMs,
    room.revision,
    nowMs,
  );
  return true;
}

function assertTargetSchema(sql: SqlStorage): void {
  assertExactColumns(sql, 'room_state', TARGET_ROOM_STATE_COLUMNS);
  assertExactColumns(sql, 'command_receipts', COMMAND_RECEIPT_COLUMNS);
  assertExactColumns(sql, 'effect_outbox', EFFECT_OUTBOX_COLUMNS);
}

/** Apply schema changes and atomically convert the previous settlement alarm intent. */
export async function migrateRoomStorage(
  storage: DurableObjectStorage,
  nowMs: number,
): Promise<void> {
  const sql = storage.sql;
  sql.exec(`
    CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT
  `);

  await storage.transaction(async () => {
    const currentVersion = sql
      .exec<{
        version: unknown;
      }>('SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations')
      .one().version;
    if (
      typeof currentVersion !== 'number' ||
      !Number.isSafeInteger(currentVersion) ||
      currentVersion < 0
    ) {
      throw new Error('Invalid Durable Object schema migration version');
    }
    if (currentVersion > ROOM_STORAGE_SCHEMA_VERSION) {
      throw new Error(`Unsupported Durable Object schema version: ${currentVersion}`);
    }

    if (currentVersion === 0) {
      const columns = readColumnNames(sql, 'room_state');
      if (columns.length === 0) {
        createFreshSchema(sql);
      } else if (hasExactColumns(columns, PREVIOUS_ROOM_STATE_COLUMNS)) {
        migratePreviousRoomState(sql, nowMs);
      } else if (hasExactColumns(columns, TARGET_ROOM_STATE_COLUMNS)) {
        createSupportingTables(sql);
      } else {
        throw new Error(`Unsupported room_state schema: ${columns.join(',')}`);
      }
      sql.exec(
        'INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (?, ?)',
        ROOM_STORAGE_SCHEMA_VERSION,
        nowMs,
      );
    }

    assertTargetSchema(sql);

    const previousSettlementValue = await storage.get(PREVIOUS_SETTLEMENT_KEY);
    if (previousSettlementValue !== undefined) {
      const shouldSchedule = insertPreviousSettlementEffect(
        sql,
        parsePreviousSettlement(previousSettlementValue),
        nowMs,
      );
      await storage.delete(PREVIOUS_SETTLEMENT_KEY);
      if (shouldSchedule) await storage.setAlarm(nowMs);
    }
  });
}
