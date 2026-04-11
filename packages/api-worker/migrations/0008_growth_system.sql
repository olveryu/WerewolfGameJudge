-- Growth system tables: user stats, game results, role collection

CREATE TABLE IF NOT EXISTS user_stats (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  xp              INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 0,
  games_played    INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_results (
  id              TEXT PRIMARY KEY,
  room_code       TEXT NOT NULL,
  user_id         TEXT NOT NULL REFERENCES users(id),
  role_id         TEXT NOT NULL,
  faction         TEXT NOT NULL,
  is_host         INTEGER NOT NULL DEFAULT 0,
  player_count    INTEGER NOT NULL,
  moon_phase      TEXT NOT NULL,
  xp_earned       INTEGER NOT NULL,
  template_id     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_game_results_user ON game_results(user_id, created_at);
CREATE UNIQUE INDEX idx_game_results_room_user ON game_results(room_code, user_id);

CREATE TABLE IF NOT EXISTS user_role_collection (
  user_id         TEXT NOT NULL REFERENCES users(id),
  role_id         TEXT NOT NULL,
  first_played_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role_id)
);
