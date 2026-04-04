-- Werewolf Game Judge — D1 Schema
-- Mirrors Supabase rooms table structure for game_state persistence

CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code       TEXT NOT NULL UNIQUE,
  host_id    TEXT NOT NULL,
  game_state TEXT,              -- JSON-serialized GameState
  state_revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);

-- Users table for self-managed auth (anonymous + email)
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email             TEXT UNIQUE,
  password_hash     TEXT,          -- bcrypt/scrypt hash, NULL for anonymous users
  display_name      TEXT,
  avatar_url        TEXT,
  custom_avatar_url TEXT,
  avatar_frame      TEXT,
  is_anonymous      INTEGER NOT NULL DEFAULT 1,  -- SQLite boolean
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
