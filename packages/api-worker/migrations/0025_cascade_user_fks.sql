-- 0025: Add ON DELETE CASCADE to user_stats, draw_history, idempotency_keys
-- These 3 tables reference users(id) without ON DELETE CASCADE, causing FK
-- violations when deleting temporary WeChat-only accounts in bind-wechat.
-- SQLite does not support ALTER CONSTRAINT; must recreate tables.

PRAGMA foreign_keys = OFF;

-- ── user_stats ──────────────────────────────────────────────────────────────

ALTER TABLE user_stats RENAME TO _user_stats_old;

CREATE TABLE user_stats (
  user_id              TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp                   INTEGER NOT NULL DEFAULT 0,
  level                INTEGER NOT NULL DEFAULT 0,
  games_played         INTEGER NOT NULL DEFAULT 0,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  last_room_code       TEXT,
  unlocked_items       TEXT NOT NULL DEFAULT '[]',
  normal_draws         INTEGER NOT NULL DEFAULT 0,
  golden_draws         INTEGER NOT NULL DEFAULT 0,
  normal_pity          INTEGER NOT NULL DEFAULT 0,
  golden_pity          INTEGER NOT NULL DEFAULT 0,
  version              INTEGER NOT NULL DEFAULT 0,
  last_login_reward_at TEXT,
  shards               INTEGER NOT NULL DEFAULT 0,
  settled_at           TEXT
);

INSERT INTO user_stats SELECT * FROM _user_stats_old;
DROP TABLE _user_stats_old;

-- ── draw_history ────────────────────────────────────────────────────────────

ALTER TABLE draw_history RENAME TO _draw_history_old;

CREATE TABLE draw_history (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draw_type         TEXT NOT NULL,
  rarity            TEXT NOT NULL,
  reward_type       TEXT NOT NULL,
  reward_id         TEXT NOT NULL,
  pity_count        INTEGER NOT NULL,
  is_pity_triggered INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  is_duplicate      INTEGER NOT NULL DEFAULT 0,
  shards_awarded    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO draw_history SELECT * FROM _draw_history_old;
DROP TABLE _draw_history_old;

CREATE INDEX idx_draw_history_user ON draw_history(user_id);
CREATE INDEX idx_draw_history_created ON draw_history(created_at);

-- ── idempotency_keys ────────────────────────────────────────────────────────

ALTER TABLE idempotency_keys RENAME TO _idempotency_keys_old;

CREATE TABLE idempotency_keys (
  key        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO idempotency_keys SELECT * FROM _idempotency_keys_old;
DROP TABLE _idempotency_keys_old;

CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);

PRAGMA foreign_keys = ON;
