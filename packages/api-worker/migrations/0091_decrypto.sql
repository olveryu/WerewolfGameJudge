-- Register 解码战 (decrypto) in the room directory game-type
-- constraints and the game-owned cumulative completed-games table.
--
-- Extend CHECK constraints using the table-copy pattern from 0090:
-- rebuild rooms with all four foreign-key dependents, then reward results.
-- Copy each table once and create named indexes only after the final rename.
-- Word inventory starts with its final category constraint and classified seeds.
PRAGMA defer_foreign_keys = true;

CREATE TABLE rooms_next (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[1-9][0-9][0-9][0-9]'),
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'pictionary', 'undercover', 'storyrelay', 'drawguess', 'avalon', 'spotmatch', 'secrethitler', 'decrypto')),
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
  word_id TEXT REFERENCES fib_words(id) ON DELETE RESTRICT,
  word TEXT NOT NULL,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  selection_tier TEXT NOT NULL CHECK (selection_tier IN (
    'category_unseen', 'any_unseen', 'category_recent', 'any_active', 'local_fallback'
  )),
  selected_at TEXT NOT NULL,
  sequence_number INTEGER,
  participant_user_ids TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms_next(id) ON DELETE CASCADE
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
  game_type TEXT NOT NULL CHECK (game_type IN ('werewolf', 'fibking', 'pictionary', 'undercover', 'storyrelay', 'drawguess', 'avalon', 'spotmatch', 'secrethitler', 'decrypto')),
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

-- Cumulative completed games and wins; no fabricated outcome or history backfill.
CREATE TABLE decrypto_user_stats (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0),
  wins INTEGER NOT NULL CHECK (typeof(wins) = 'integer' AND wins >= 0)
);

CREATE TABLE decrypto_words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL UNIQUE CHECK (length(trim(word)) > 0),
  category TEXT NOT NULL CHECK (category IN (
    'animals', 'plants', 'food', 'drinks', 'desserts', 'ingredients', 'cooking',
    'dailyObjects', 'vehicles', 'places', 'occupations', 'clothing', 'furniture',
    'kitchenware', 'tools', 'stationery', 'electronics', 'toys', 'sports',
    'instruments', 'music', 'art', 'literature', 'filmAndTelevision', 'festivals',
    'geography', 'weather', 'space', 'architecture', 'oceanLife', 'insects',
    'pets', 'health', 'medicalSupplies', 'bodyParts', 'school', 'work', 'travel',
    'outdoorActivities', 'crafts'
  )),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_decrypto_words_active ON decrypto_words(status, id);
CREATE INDEX idx_decrypto_words_category_created ON decrypto_words(category, created_at DESC, word);

CREATE TABLE decrypto_round_word_selections (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL,
  game_sequence INTEGER NOT NULL CHECK (game_sequence > 0),
  request_id TEXT NOT NULL,
  keywords_json TEXT NOT NULL CHECK (json_valid(keywords_json) AND json_type(keywords_json) = 'object'),
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, game_sequence),
  UNIQUE (room_id, request_id)
);
CREATE INDEX idx_decrypto_word_selections_history
  ON decrypto_round_word_selections(room_id, room_creation_id, game_sequence);

INSERT INTO decrypto_words (id, word, status, created_at, category) VALUES
  ('decrypto-seed-001', '雨伞', 'active', '2026-11-26T00:00:00.000Z', 'dailyObjects'),
  ('decrypto-seed-002', '望远镜', 'active', '2026-11-26T00:00:00.000Z', 'tools'),
  ('decrypto-seed-003', '冰箱', 'active', '2026-11-26T00:00:00.000Z', 'electronics'),
  ('decrypto-seed-004', '滑板', 'active', '2026-11-26T00:00:00.000Z', 'sports'),
  ('decrypto-seed-005', '火车', 'active', '2026-11-26T00:00:00.000Z', 'vehicles'),
  ('decrypto-seed-006', '潜水', 'active', '2026-11-26T00:00:00.000Z', 'sports'),
  ('decrypto-seed-007', '烤箱', 'active', '2026-11-26T00:00:00.000Z', 'electronics'),
  ('decrypto-seed-008', '月亮', 'active', '2026-11-26T00:00:00.000Z', 'space'),
  ('decrypto-seed-009', '沙漠', 'active', '2026-11-26T00:00:00.000Z', 'geography'),
  ('decrypto-seed-010', '图书馆', 'active', '2026-11-26T00:00:00.000Z', 'places'),
  ('decrypto-seed-011', '蛋糕', 'active', '2026-11-26T00:00:00.000Z', 'desserts'),
  ('decrypto-seed-012', '吉他', 'active', '2026-11-26T00:00:00.000Z', 'instruments'),
  ('decrypto-seed-013', '鲸鱼', 'active', '2026-11-26T00:00:00.000Z', 'oceanLife'),
  ('decrypto-seed-014', '火山', 'active', '2026-11-26T00:00:00.000Z', 'geography'),
  ('decrypto-seed-015', '足球', 'active', '2026-11-26T00:00:00.000Z', 'sports'),
  ('decrypto-seed-016', '城堡', 'active', '2026-11-26T00:00:00.000Z', 'architecture'),
  ('decrypto-seed-017', '机器人', 'active', '2026-11-26T00:00:00.000Z', 'electronics'),
  ('decrypto-seed-018', '瀑布', 'active', '2026-11-26T00:00:00.000Z', 'geography'),
  ('decrypto-seed-019', '望梅止渴', 'active', '2026-11-26T00:00:00.000Z', 'literature'),
  ('decrypto-seed-020', '风筝', 'active', '2026-11-26T00:00:00.000Z', 'toys'),
  ('decrypto-seed-021', '摩天轮', 'active', '2026-11-26T00:00:00.000Z', 'places'),
  ('decrypto-seed-022', '闪电', 'active', '2026-11-26T00:00:00.000Z', 'weather'),
  ('decrypto-seed-023', '指南针', 'active', '2026-11-26T00:00:00.000Z', 'tools'),
  ('decrypto-seed-024', '棉花糖', 'active', '2026-11-26T00:00:00.000Z', 'desserts'),
  ('decrypto-seed-025', '潜艇', 'active', '2026-11-26T00:00:00.000Z', 'vehicles'),
  ('decrypto-seed-026', '滑雪', 'active', '2026-11-26T00:00:00.000Z', 'sports'),
  ('decrypto-seed-027', '电视机', 'active', '2026-11-26T00:00:00.000Z', 'electronics'),
  ('decrypto-seed-028', '口琴', 'active', '2026-11-26T00:00:00.000Z', 'instruments'),
  ('decrypto-seed-029', '珊瑚', 'active', '2026-11-26T00:00:00.000Z', 'oceanLife'),
  ('decrypto-seed-030', '龙卷风', 'active', '2026-11-26T00:00:00.000Z', 'weather'),
  ('decrypto-seed-031', '冰淇淋', 'active', '2026-11-26T00:00:00.000Z', 'desserts'),
  ('decrypto-seed-032', '温泉', 'active', '2026-11-26T00:00:00.000Z', 'places');
