PRAGMA defer_foreign_keys = true;

CREATE TABLE rooms_next (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'pictionary', 'undercover', 'storyrelay')),
  host_user_id TEXT NOT NULL,
  creation_id TEXT NOT NULL UNIQUE CHECK (length(creation_id) > 0),
  config_json TEXT NOT NULL CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('creating', 'active', 'deleting', 'failed')),
  failure_operation TEXT CHECK (failure_operation IN ('create', 'delete')),
  last_error TEXT,
  reconciliation_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (reconciliation_attempt_count >= 0),
  reconcile_after TEXT,
  delete_requested_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  games_started INTEGER NOT NULL DEFAULT 0,
  last_started_at TEXT,
  CHECK ((status = 'failed') = (failure_operation IS NOT NULL)),
  CHECK (status NOT IN ('deleting', 'failed') OR failure_operation = 'create' OR delete_requested_by IS NOT NULL)
);
INSERT INTO rooms_next SELECT * FROM rooms;

CREATE TABLE room_game_starts_next (
  effect_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  started_revision INTEGER NOT NULL CHECK (started_revision > 0),
  started_at TEXT NOT NULL,
  UNIQUE (room_id, started_revision)
);
INSERT INTO room_game_starts_next SELECT * FROM room_game_starts;

CREATE TABLE room_participants_next (
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
INSERT INTO room_participants_next SELECT * FROM room_participants;

CREATE TABLE fib_round_word_selections_next (
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
  selection_tier TEXT NOT NULL CHECK (selection_tier IN ('category_unseen', 'any_unseen', 'category_recent', 'any_active', 'local_fallback')),
  selected_at TEXT NOT NULL,
  sequence_number INTEGER,
  participant_user_ids TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms_next(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES fib_words(id) ON DELETE RESTRICT
);
INSERT INTO fib_round_word_selections_next SELECT * FROM fib_round_word_selections;

CREATE TABLE undercover_round_word_selections_next (
  room_id TEXT NOT NULL REFERENCES rooms_next(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_pair_id TEXT NOT NULL REFERENCES undercover_word_pairs(id) ON DELETE RESTRICT,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL,
  category TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, round_id)
);
INSERT INTO undercover_round_word_selections_next SELECT * FROM undercover_round_word_selections;

DROP TABLE room_game_starts;
DROP TABLE room_participants;
DROP TABLE fib_round_word_selections;
DROP TABLE undercover_round_word_selections;
DROP TABLE rooms;
ALTER TABLE rooms_next RENAME TO rooms;
ALTER TABLE room_game_starts_next RENAME TO room_game_starts;
ALTER TABLE room_participants_next RENAME TO room_participants;
ALTER TABLE fib_round_word_selections_next RENAME TO fib_round_word_selections;
ALTER TABLE undercover_round_word_selections_next RENAME TO undercover_round_word_selections;
CREATE INDEX idx_rooms_status_reconcile ON rooms(status, reconcile_after);
CREATE INDEX idx_rooms_host_user ON rooms(host_user_id);
CREATE INDEX idx_room_game_starts_room_started ON room_game_starts(room_id, started_at);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_fib_round_word_selections_word ON fib_round_word_selections(word_id, selected_at);
CREATE INDEX idx_undercover_selections_history ON undercover_round_word_selections(room_id, room_creation_id, word_pair_id);

CREATE TABLE product_game_reward_results_next (
  settlement_id TEXT NOT NULL REFERENCES product_game_reward_claims(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'pictionary', 'undercover', 'storyrelay')),
  reward_kind TEXT NOT NULL CHECK (reward_kind IN ('completion', 'mvp')),
  reward_date TEXT NOT NULL,
  previous_xp INTEGER NOT NULL CHECK (previous_xp >= 0),
  xp_earned INTEGER NOT NULL CHECK (xp_earned >= 0),
  new_xp INTEGER NOT NULL CHECK (new_xp = previous_xp + xp_earned),
  previous_level INTEGER NOT NULL CHECK (previous_level >= 0),
  new_level INTEGER NOT NULL CHECK (new_level >= 0),
  normal_draws_earned INTEGER NOT NULL CHECK (normal_draws_earned >= 0),
  golden_draws_earned INTEGER NOT NULL CHECK (golden_draws_earned >= 0),
  stats_applied INTEGER NOT NULL DEFAULT 0 CHECK (stats_applied IN (0, 1)),
  PRIMARY KEY (settlement_id, user_id)
);
INSERT INTO product_game_reward_results_next SELECT * FROM product_game_reward_results;
DROP TABLE product_game_reward_results;
ALTER TABLE product_game_reward_results_next RENAME TO product_game_reward_results;
CREATE INDEX idx_product_game_reward_daily ON product_game_reward_results(user_id, game_type, reward_kind, reward_date);

PRAGMA defer_foreign_keys = false;