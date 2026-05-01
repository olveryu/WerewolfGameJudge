/**
 * testSchemaBootstrap — 测试 D1 schema 唯一来源
 *
 * vitest-pool-workers 使用内存 D1，无法自动跑 migrations。
 * 所有测试通过此模块创建表结构，避免 CREATE TABLE 散布在各测试文件。
 * 新增 migration 后只需更新此文件。
 */

/** CREATE TABLE + INDEX 语句，与 migrations/ 保持同步 */
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
] as const;

/**
 * 在 D1 实例上创建所有表 + 索引。
 * 使用 `CREATE TABLE IF NOT EXISTS`，可安全重复调用。
 *
 * D1 exec 按换行拆分语句，因此将每条 SQL 压成单行后执行。
 */
export async function bootstrapTestSchema(db: D1Database): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    const oneLiner = stmt.replace(/\s+/g, ' ').trim();
    await db.exec(oneLiner);
  }
}
