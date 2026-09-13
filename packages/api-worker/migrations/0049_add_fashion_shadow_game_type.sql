-- Register Fashion Shadow in the room directory game-type constraint without losing room-owned data.

PRAGMA defer_foreign_keys = true;

CREATE TABLE rooms_next (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'fashion-shadow')),
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

INSERT INTO rooms_next (
  id,
  code,
  game_type,
  host_user_id,
  creation_id,
  config_json,
  status,
  failure_operation,
  last_error,
  reconciliation_attempt_count,
  reconcile_after,
  delete_requested_by,
  created_at,
  updated_at,
  games_started,
  last_started_at
)
SELECT
  id,
  code,
  game_type,
  host_user_id,
  creation_id,
  config_json,
  status,
  failure_operation,
  last_error,
  reconciliation_attempt_count,
  reconcile_after,
  delete_requested_by,
  created_at,
  updated_at,
  games_started,
  last_started_at
FROM rooms;

CREATE TABLE room_game_starts_backup AS
SELECT effect_id, room_id, started_revision, started_at
FROM room_game_starts;

CREATE TABLE room_participants_backup AS
SELECT room_id, user_id, joined_at
FROM room_participants;

CREATE TABLE fib_round_word_selections_backup AS
SELECT
  room_id,
  room_creation_id,
  effect_id,
  round_id,
  request_fingerprint,
  word_id,
  word,
  core_meaning,
  usage_note,
  source,
  selection_tier,
  selected_at
FROM fib_round_word_selections;

DROP TABLE room_game_starts;
DROP TABLE room_participants;
DROP TABLE fib_round_word_selections;
DROP TABLE rooms;

ALTER TABLE rooms_next RENAME TO rooms;

CREATE TABLE room_game_starts (
  effect_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  started_revision INTEGER NOT NULL CHECK (started_revision > 0),
  started_at TEXT NOT NULL,
  UNIQUE (room_id, started_revision)
);

INSERT INTO room_game_starts (effect_id, room_id, started_revision, started_at)
SELECT effect_id, room_id, started_revision, started_at
FROM room_game_starts_backup;

CREATE TABLE room_participants (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

INSERT INTO room_participants (room_id, user_id, joined_at)
SELECT room_id, user_id, joined_at
FROM room_participants_backup;

CREATE TABLE fib_round_word_selections (
  room_id TEXT NOT NULL,
  room_creation_id TEXT NOT NULL,
  effect_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_id TEXT,
  word TEXT NOT NULL,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  selection_tier TEXT NOT NULL CHECK (
    selection_tier IN (
      'category_unseen',
      'any_unseen',
      'category_recent',
      'any_active',
      'local_fallback'
    )
  ),
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES fib_words(id) ON DELETE RESTRICT
);

INSERT INTO fib_round_word_selections (
  room_id,
  room_creation_id,
  effect_id,
  round_id,
  request_fingerprint,
  word_id,
  word,
  core_meaning,
  usage_note,
  source,
  selection_tier,
  selected_at
)
SELECT
  room_id,
  room_creation_id,
  effect_id,
  round_id,
  request_fingerprint,
  word_id,
  word,
  core_meaning,
  usage_note,
  source,
  selection_tier,
  selected_at
FROM fib_round_word_selections_backup;

DROP TABLE room_game_starts_backup;
DROP TABLE room_participants_backup;
DROP TABLE fib_round_word_selections_backup;

CREATE INDEX idx_rooms_status_reconcile ON rooms(status, reconcile_after);
CREATE INDEX idx_rooms_host_user ON rooms(host_user_id);
CREATE INDEX idx_room_game_starts_room_started
  ON room_game_starts(room_id, started_at);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_fib_round_word_selections_word
  ON fib_round_word_selections(word_id, selected_at);

PRAGMA defer_foreign_keys = false;
