-- Room directory rows are forward-recoverable saga records, not only lookup aliases.
-- Migration 0034 already invalidated every room from the room-code-as-DO-ID model.

PRAGMA defer_foreign_keys = true;

CREATE TABLE rooms_next (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf')),
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
);

DROP TABLE room_game_starts;
DROP TABLE room_participants;
DROP TABLE rooms;
ALTER TABLE rooms_next RENAME TO rooms;

CREATE INDEX idx_rooms_status_reconcile ON rooms(status, reconcile_after);
CREATE INDEX idx_rooms_host_user ON rooms(host_user_id);

CREATE TABLE room_game_starts (
  effect_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  started_revision INTEGER NOT NULL CHECK (started_revision > 0),
  started_at TEXT NOT NULL,
  UNIQUE (room_id, started_revision)
);
CREATE INDEX idx_room_game_starts_room_started
  ON room_game_starts(room_id, started_at);

CREATE TABLE room_participants (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);

PRAGMA defer_foreign_keys = false;
