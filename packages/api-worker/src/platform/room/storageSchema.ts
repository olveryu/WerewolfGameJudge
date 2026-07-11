/** Durable Object SQLite schema bootstrap and strict version validation. */

const ROOM_STORAGE_SCHEMA_VERSION = 1;

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

function createFreshSchema(sql: SqlStorage): void {
  sql.exec(`
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
  `);
}

function assertTargetSchema(sql: SqlStorage): void {
  assertExactColumns(sql, 'room_state', TARGET_ROOM_STATE_COLUMNS);
  assertExactColumns(sql, 'command_receipts', COMMAND_RECEIPT_COLUMNS);
  assertExactColumns(sql, 'effect_outbox', EFFECT_OUTBOX_COLUMNS);
}

/** Initialize a new room store or validate the exact current schema. */
export function initializeRoomStorage(storage: DurableObjectStorage, nowMs: number): void {
  const sql = storage.sql;
  storage.transactionSync(() => {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      ) STRICT
    `);

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
      throw new Error('Invalid Durable Object schema version');
    }
    if (currentVersion > ROOM_STORAGE_SCHEMA_VERSION) {
      throw new Error(`Unsupported Durable Object schema version: ${currentVersion}`);
    }

    if (currentVersion === 0) {
      const existingColumns = readColumnNames(sql, 'room_state');
      if (existingColumns.length > 0) {
        throw new Error(`Unsupported unversioned room_state schema: ${existingColumns.join(',')}`);
      }
      createFreshSchema(sql);
      sql.exec(
        'INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (?, ?)',
        ROOM_STORAGE_SCHEMA_VERSION,
        nowMs,
      );
    }

    assertTargetSchema(sql);
  });
}
