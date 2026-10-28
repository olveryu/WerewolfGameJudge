/**
 * Durable Object SQLite schema for one room: single current version, no migration chain.
 *
 * Storage created by any earlier schema is discarded on wake (rooms are short-lived party sessions
 * and old rooms are not carried across a platform storage redesign). Game state version evolution
 * inside `room_state.game_state` remains the game module's own concern.
 */

export const ROOM_STORAGE_SCHEMA_VERSION = 3;

const ROOM_STATE_COLUMNS = [
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

const EFFECT_REPLAY_COLUMNS = [
  'id',
  'effect_id',
  'reason',
  'requested_by',
  'requested_at',
  'original_effect_json',
  'status',
  'completed_at',
  'last_error',
] as const;

interface ColumnInfoRow extends Record<string, SqlStorageValue> {
  readonly name: SqlStorageValue;
}

interface SchemaVersionRow extends Record<string, SqlStorageValue> {
  readonly version: SqlStorageValue;
}

interface TableNameRow extends Record<string, SqlStorageValue> {
  readonly name: SqlStorageValue;
}

export type RoomStorageInitialization = 'created' | 'current' | 'discarded';

function readColumnNames(sql: SqlStorage, table: string): string[] {
  return sql
    .exec<ColumnInfoRow>(`PRAGMA table_info(${table})`)
    .toArray()
    .map((row, index) => {
      if (typeof row.name !== 'string') {
        throw new Error(`${table} column ${index} has an invalid name`);
      }
      return row.name;
    });
}

function assertExactColumns(sql: SqlStorage, table: string, expected: readonly string[]): void {
  const actual = readColumnNames(sql, table);
  const matches =
    actual.length === expected.length && expected.every((column) => actual.includes(column));
  if (!matches) {
    throw new Error(`Unsupported ${table} schema: ${actual.join(',')}`);
  }
}

function readUserTableNames(sql: SqlStorage): string[] {
  return sql
    .exec<TableNameRow>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .toArray()
    .map((row) => {
      if (typeof row.name !== 'string') throw new Error('sqlite_master returned a non-string name');
      return row.name;
    });
}

function readSchemaVersion(sql: SqlStorage): number | null {
  const tables = readUserTableNames(sql);
  if (tables.length === 0) return null;
  if (!tables.includes('room_schema')) return 0;
  const row = sql.exec<SchemaVersionRow>('SELECT version FROM room_schema WHERE id = 1').one();
  if (typeof row.version !== 'number' || !Number.isSafeInteger(row.version) || row.version < 1) {
    throw new Error('room_schema.version is invalid');
  }
  return row.version;
}

function createSchema(sql: SqlStorage, nowMs: number): void {
  sql.exec(`
    CREATE TABLE room_schema (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL CHECK (version > 0),
      created_at INTEGER NOT NULL CHECK (created_at >= 0)
    ) STRICT;

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
    ) STRICT;

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

    CREATE TABLE effect_replays (
      id TEXT PRIMARY KEY,
      effect_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      requested_at INTEGER NOT NULL,
      original_effect_json TEXT NOT NULL CHECK (json_valid(original_effect_json)),
      status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
      completed_at INTEGER,
      last_error TEXT
    ) STRICT;
    CREATE UNIQUE INDEX effect_replays_pending_idx
      ON effect_replays(effect_id) WHERE status = 'pending';
  `);
  sql.exec(
    'INSERT INTO room_schema (id, version, created_at) VALUES (1, ?, ?)',
    ROOM_STORAGE_SCHEMA_VERSION,
    nowMs,
  );
}

function assertCurrentSchema(sql: SqlStorage): void {
  assertExactColumns(sql, 'room_state', ROOM_STATE_COLUMNS);
  assertExactColumns(sql, 'command_receipts', COMMAND_RECEIPT_COLUMNS);
  assertExactColumns(sql, 'effect_outbox', EFFECT_OUTBOX_COLUMNS);
  assertExactColumns(sql, 'effect_replays', EFFECT_REPLAY_COLUMNS);
}

/**
 * Create the current schema on empty storage, validate it when current, or discard everything
 * (including any alarm) when the stored schema is not the current version.
 */
export async function initializeRoomStorage(
  storage: DurableObjectStorage,
  nowMs: number,
): Promise<RoomStorageInitialization> {
  const sql = storage.sql;
  const version = readSchemaVersion(sql);
  if (version === ROOM_STORAGE_SCHEMA_VERSION) {
    assertCurrentSchema(sql);
    return 'current';
  }
  if (version !== null) {
    await storage.deleteAll();
    storage.transactionSync(() => createSchema(sql, nowMs));
    return 'discarded';
  }
  storage.transactionSync(() => createSchema(sql, nowMs));
  return 'created';
}
