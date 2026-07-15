/**
 * testSchemaBootstrap — single source of truth for the test D1 schema
 *
 * vitest-pool-workers uses an in-memory D1 that cannot run migrations automatically.
 * All tests create the table structure through this module, avoiding scattered CREATE TABLE statements across test files.
 * After adding a migration, only this file needs to be updated.
 */

/** CREATE TABLE + INDEX statements, kept in sync with migrations/ */
const SCHEMA_STATEMENTS = [
  // ── users ──
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT,
    custom_avatar_url TEXT,
    avatar_frame TEXT,
    equipped_flair TEXT,
    equipped_name_style TEXT,
    equipped_effect TEXT,
    equipped_seat_animation TEXT,
    wechat_openid TEXT,
    is_anonymous INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    last_country TEXT,
    last_colo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_openid ON users(wechat_openid);`,

  // ── refresh_tokens ──
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);`,

  // ── user_stats ──
  `CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    last_room_code TEXT,
    unlocked_items TEXT NOT NULL DEFAULT '[]',
    normal_draws INTEGER NOT NULL DEFAULT 0,
    golden_draws INTEGER NOT NULL DEFAULT 0,
    normal_pity INTEGER NOT NULL DEFAULT 0,
    golden_pity INTEGER NOT NULL DEFAULT 0,
    shards INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    last_login_reward_at TEXT,
    settled_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // ── password_reset_tokens ──
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_used INTEGER NOT NULL DEFAULT 0,
    verify_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // ── login_attempts ──
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    attempted_at TEXT NOT NULL
  );`,

  // ── draw_history ──
  `CREATE TABLE IF NOT EXISTS draw_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    draw_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    pity_count INTEGER NOT NULL,
    is_pity_triggered INTEGER NOT NULL DEFAULT 0,
    is_duplicate INTEGER NOT NULL DEFAULT 0,
    shards_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // ── idempotency_keys ──
  `CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    response TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at);`,

  // ── camp_settlements ──
  `CREATE TABLE IF NOT EXISTS camp_settlements (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settle_key TEXT NOT NULL,
    camp TEXT NOT NULL,
    settled_at TEXT NOT NULL,
    PRIMARY KEY (user_id, settle_key)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_camp_settlements_user_settled ON camp_settlements(user_id, settled_at);`,

  // ── game_settlement_results ──
  `CREATE TABLE IF NOT EXISTS game_settlement_results (
    effect_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_code TEXT NOT NULL,
    participant_fingerprint TEXT NOT NULL,
    camp TEXT NOT NULL CHECK (camp IN ('wolf', 'god', 'villager', 'third')),
    previous_xp INTEGER NOT NULL CHECK (previous_xp >= 0),
    xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
    new_xp INTEGER NOT NULL CHECK (new_xp = previous_xp + xp_earned),
    previous_level INTEGER NOT NULL CHECK (previous_level >= 0),
    new_level INTEGER NOT NULL CHECK (new_level >= previous_level),
    normal_draws_earned INTEGER NOT NULL CHECK (normal_draws_earned >= 0),
    golden_draws_earned INTEGER NOT NULL CHECK (golden_draws_earned >= 0),
    stats_applied INTEGER NOT NULL DEFAULT 0 CHECK (stats_applied IN (0, 1)),
    settled_at TEXT NOT NULL,
    PRIMARY KEY (effect_id, user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_game_settlement_results_user_settled
    ON game_settlement_results(user_id, settled_at);`,

  // ── user_event_inbox ──
  `CREATE TABLE IF NOT EXISTS user_event_inbox (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object'),
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, event_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_user_event_inbox_delivery
    ON user_event_inbox(user_id, created_at, event_id);`,

  // ── rooms ──
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
    game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking')),
    host_user_id TEXT NOT NULL,
    creation_id TEXT NOT NULL UNIQUE CHECK (length(creation_id) > 0),
    config_json TEXT NOT NULL CHECK (
      json_valid(config_json) AND json_type(config_json) = 'object'
    ),
    status TEXT NOT NULL CHECK (status IN ('creating', 'active', 'deleting', 'failed')),
    failure_operation TEXT CHECK (failure_operation IN ('create', 'delete')),
    last_error TEXT,
    reconciliation_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (
      reconciliation_attempt_count >= 0
    ),
    reconcile_after TEXT,
    delete_requested_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    games_started INTEGER NOT NULL DEFAULT 0,
    last_started_at TEXT,
    CHECK ((status = 'failed') = (failure_operation IS NOT NULL)),
    CHECK (
      status NOT IN ('deleting', 'failed')
      OR failure_operation = 'create'
      OR delete_requested_by IS NOT NULL
    )
  );`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status_reconcile
    ON rooms(status, reconcile_after);`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_host_user ON rooms(host_user_id);`,

  // ── room_game_starts ──
  `CREATE TABLE IF NOT EXISTS room_game_starts (
    effect_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    started_revision INTEGER NOT NULL CHECK (started_revision > 0),
    started_at TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_room_game_starts_room_revision
    ON room_game_starts(room_id, started_revision);`,
  `CREATE INDEX IF NOT EXISTS idx_room_game_starts_room_started
    ON room_game_starts(room_id, started_at);`,

  // ── room_participants ──
  `CREATE TABLE IF NOT EXISTS room_participants (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (room_id, user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);`,

  // ── fib_word_generation_results ──
  `CREATE TABLE IF NOT EXISTS fib_word_generation_results (
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    room_creation_id TEXT NOT NULL CHECK (length(room_creation_id) > 0),
    effect_id TEXT NOT NULL CHECK (length(effect_id) > 0),
    round_id TEXT NOT NULL CHECK (length(round_id) > 0),
    request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
    word TEXT NOT NULL CHECK (length(trim(word)) BETWEEN 2 AND 12),
    definition TEXT NOT NULL CHECK (length(trim(definition)) BETWEEN 8 AND 120),
    source TEXT NOT NULL CHECK (source IN ('gemini', 'workers-ai', 'local')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (room_id, effect_id)
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fib_word_generation_results_room_round
    ON fib_word_generation_results(room_id, round_id);`,
  `CREATE INDEX IF NOT EXISTS idx_fib_word_generation_results_created
    ON fib_word_generation_results(created_at);`,
] as const;

/**
 * Creates all tables + indexes on a D1 instance.
 * Uses `CREATE TABLE IF NOT EXISTS`, so it is safe to call multiple times.
 *
 * D1 exec splits statements by newline, so each SQL statement is collapsed to a single line before execution.
 */
export async function bootstrapTestSchema(db: D1Database): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    const oneLiner = stmt.replace(/\s+/g, ' ').trim();
    await db.exec(oneLiner);
  }
}
