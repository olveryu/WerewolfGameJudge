-- Idempotent ledger for at-least-once platform.room.gameStarted effects.

CREATE TABLE room_game_starts (
  effect_id        TEXT PRIMARY KEY,
  room_code       TEXT NOT NULL,
  started_revision INTEGER NOT NULL CHECK (started_revision > 0),
  started_at      TEXT NOT NULL,
  FOREIGN KEY (room_code) REFERENCES rooms(code) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_room_game_starts_room_revision
  ON room_game_starts(room_code, started_revision);

CREATE INDEX idx_room_game_starts_room_started
  ON room_game_starts(room_code, started_at);
