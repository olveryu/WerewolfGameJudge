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

  // ── rooms ──
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    host_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    games_started INTEGER NOT NULL DEFAULT 0,
    last_started_at TEXT
  );`,

  // ── room_participants ──
  `CREATE TABLE IF NOT EXISTS room_participants (
    room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (room_code, user_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_room_participants_room_code ON room_participants(room_code);`,
  `CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);`,
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
