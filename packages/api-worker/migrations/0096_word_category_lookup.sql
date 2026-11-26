-- Word category lookup: the four word tables and four pack tables reference word_categories.
--
-- Each table gains a VIRTUAL generated constant column game (no storage, no extra writes, no
-- change to INSERT statements) and FOREIGN KEY (game, category) → word_categories(game, id);
-- every category CHECK list is dropped. fib_words.category becomes NOT NULL ('other' is a
-- regular category row; historical fib_word_packs rows also carry 'other').
-- Every foreign-key descendant of a rebuilt parent is rebuilt in this file (RESTRICT children
-- fail the implicit DELETE of DROP TABLE immediately; NO ACTION children fail at commit):
--   fib_words ← fib_round_word_selections, fib_word_usages (RESTRICT)
--   undercover_word_pairs ← undercover_round_word_selections (RESTRICT)
--   fib_word_packs ← fib_word_provider_requests (NO ACTION)
--   The other five parents have no foreign-key children.
-- Triggers referencing these tables (draw triggers, fib_word_sequence_draw_insert) are dropped
-- first and recreated verbatim: RENAME (legacy_alter_table=OFF) validates every trigger.
-- Generated columns are never copied: this and every later rebuild uses explicit column lists.

PRAGMA defer_foreign_keys = true;

DROP TRIGGER drawguess_words_draw_delete;

DROP TRIGGER drawguess_words_draw_insert;

DROP TRIGGER drawguess_words_draw_ordinal_immutable;

DROP TRIGGER drawguess_words_draw_update;

DROP TRIGGER fib_word_sequence_draw_insert;

DROP TRIGGER fib_words_draw_delete;

DROP TRIGGER fib_words_draw_insert;

DROP TRIGGER fib_words_draw_update;

DROP TRIGGER undercover_word_pairs_draw_delete;

DROP TRIGGER undercover_word_pairs_draw_insert;

DROP TRIGGER undercover_word_pairs_draw_ordinal_immutable;

DROP TRIGGER undercover_word_pairs_draw_update;

CREATE TABLE fib_words_next (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('fibking') VIRTUAL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  selection_key INTEGER NOT NULL CHECK (selection_key >= 0),
  generation_cycle_id TEXT,
  created_at TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  disabled_at TEXT,
  status_reason TEXT,
  CHECK (
    (status = 'active' AND disabled_at IS NULL AND status_reason IS NULL) OR
    (status = 'disabled' AND disabled_at IS NOT NULL AND status_reason IS NOT NULL)
  ),
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE undercover_word_pairs_next (
  id TEXT PRIMARY KEY,
  word_a TEXT NOT NULL CHECK (length(trim(word_a)) > 0),
  word_b TEXT NOT NULL CHECK (length(trim(word_b)) > 0 AND word_a < word_b),
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('undercover') VIRTUAL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  review_json TEXT NOT NULL CHECK (json_valid(review_json)),
  draw_ordinal INTEGER,
  UNIQUE (word_a, word_b),
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE drawguess_words_next (
  id TEXT PRIMARY KEY, 
  word TEXT NOT NULL UNIQUE, 
  pinyin_initials TEXT NOT NULL, 
  category TEXT NOT NULL, 
  game TEXT NOT NULL GENERATED ALWAYS AS ('drawguess') VIRTUAL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')), 
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')), 
  created_at TEXT NOT NULL, 
  disabled_at TEXT, draw_ordinal INTEGER, 
  CHECK (
    (status = 'active' AND disabled_at IS NULL) OR
    (status = 'disabled' AND disabled_at IS NOT NULL)
  ),
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE decrypto_words_next (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL UNIQUE CHECK (length(trim(word)) > 0),
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('decrypto') VIRTUAL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE fib_word_packs_next (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL REFERENCES fib_word_supply_months(id),
  request_token TEXT NOT NULL,
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('fibking') VIRTUAL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  source_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  published_at TEXT,
  outcome TEXT CHECK (outcome IN ('noCandidates', 'allRejected', 'reviewed')),
  search_index INTEGER,
  search_selected_at TEXT,
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE undercover_word_packs_next (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('undercover') VIRTUAL,
  request_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  review_version TEXT NOT NULL,
  generation_json TEXT CHECK (generation_json IS NULL OR json_valid(generation_json)),
  candidates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(candidates_json)),
  reviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reviews_json)),
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE drawguess_word_packs_next (
  id TEXT PRIMARY KEY, 
  category TEXT NOT NULL, 
  game TEXT NOT NULL GENERATED ALWAYS AS ('drawguess') VIRTUAL,
  request_token TEXT NOT NULL, 
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')), 
  model TEXT NOT NULL, 
  prompt_version TEXT NOT NULL, 
  review_version TEXT NOT NULL, 
  generation_json TEXT CHECK (generation_json IS NULL OR json_valid(generation_json)), 
  candidates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(candidates_json)), 
  reviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reviews_json)), 
  failure_reason TEXT, 
  created_at TEXT NOT NULL, 
  completed_at TEXT,
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE decrypto_word_packs_next (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  game TEXT NOT NULL GENERATED ALWAYS AS ('decrypto') VIRTUAL,
  request_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  review_version TEXT NOT NULL,
  generation_json TEXT CHECK (generation_json IS NULL OR json_valid(generation_json)),
  candidates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(candidates_json)),
  reviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reviews_json)),
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE fib_word_provider_requests_next (
  pack_id TEXT NOT NULL REFERENCES fib_word_packs_next(id),
  operation TEXT NOT NULL,
  PRIMARY KEY (pack_id, operation)
);

CREATE TABLE fib_word_usages_next (
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  word_id TEXT REFERENCES fib_words_next(id) ON DELETE RESTRICT,
  word TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  used_at TEXT NOT NULL,
  participant_count INTEGER NOT NULL CHECK (participant_count > 0),
  PRIMARY KEY (room_creation_id, round_id)
);

CREATE TABLE fib_round_word_selections_next (
  room_id TEXT NOT NULL,
  room_creation_id TEXT NOT NULL,
  effect_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_id TEXT REFERENCES fib_words_next(id) ON DELETE RESTRICT,
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
  FOREIGN KEY (room_id) REFERENCES "rooms"(id) ON DELETE CASCADE
);

CREATE TABLE undercover_round_word_selections_next (
  room_id TEXT NOT NULL REFERENCES "rooms"(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_pair_id TEXT NOT NULL REFERENCES undercover_word_pairs_next(id) ON DELETE RESTRICT,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL,
  category TEXT NOT NULL,
  selected_at TEXT NOT NULL,
  PRIMARY KEY (room_id, round_id)
);

INSERT INTO fib_words_next (id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at, disabled_at, status_reason) SELECT id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at, disabled_at, status_reason FROM fib_words;

INSERT INTO undercover_word_pairs_next (id, word_a, word_b, category, status, created_at, reviewed_at, review_json, draw_ordinal) SELECT id, word_a, word_b, category, status, created_at, reviewed_at, review_json, draw_ordinal FROM undercover_word_pairs;

INSERT INTO drawguess_words_next (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at, draw_ordinal) SELECT id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at, draw_ordinal FROM drawguess_words;

INSERT INTO decrypto_words_next (id, word, category, status, created_at) SELECT id, word, category, status, created_at FROM decrypto_words;

INSERT INTO fib_word_packs_next (id, month_id, request_token, category, status, source_json, created_at, published_at, outcome, search_index, search_selected_at) SELECT id, month_id, request_token, category, status, source_json, created_at, published_at, outcome, search_index, search_selected_at FROM fib_word_packs;

INSERT INTO undercover_word_packs_next (id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at) SELECT id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at FROM undercover_word_packs;

INSERT INTO drawguess_word_packs_next (id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at) SELECT id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at FROM drawguess_word_packs;

INSERT INTO decrypto_word_packs_next (id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at) SELECT id, category, request_token, status, model, prompt_version, review_version, generation_json, candidates_json, reviews_json, failure_reason, created_at, completed_at FROM decrypto_word_packs;

INSERT INTO fib_word_provider_requests_next (pack_id, operation) SELECT pack_id, operation FROM fib_word_provider_requests;

INSERT INTO fib_word_usages_next (room_creation_id, round_id, word_id, word, source, used_at, participant_count) SELECT room_creation_id, round_id, word_id, word, source, used_at, participant_count FROM fib_word_usages;

INSERT INTO fib_round_word_selections_next (room_id, room_creation_id, effect_id, round_id, request_fingerprint, word_id, word, core_meaning, usage_note, source, selection_tier, selected_at, sequence_number, participant_user_ids) SELECT room_id, room_creation_id, effect_id, round_id, request_fingerprint, word_id, word, core_meaning, usage_note, source, selection_tier, selected_at, sequence_number, participant_user_ids FROM fib_round_word_selections;

INSERT INTO undercover_round_word_selections_next (room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at) SELECT room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at FROM undercover_round_word_selections;

DROP TABLE fib_word_provider_requests;

DROP TABLE fib_word_usages;

DROP TABLE fib_round_word_selections;

DROP TABLE undercover_round_word_selections;

DROP TABLE fib_words;

DROP TABLE undercover_word_pairs;

DROP TABLE drawguess_words;

DROP TABLE decrypto_words;

DROP TABLE fib_word_packs;

DROP TABLE undercover_word_packs;

DROP TABLE drawguess_word_packs;

DROP TABLE decrypto_word_packs;

ALTER TABLE fib_words_next RENAME TO fib_words;

ALTER TABLE undercover_word_pairs_next RENAME TO undercover_word_pairs;

ALTER TABLE drawguess_words_next RENAME TO drawguess_words;

ALTER TABLE decrypto_words_next RENAME TO decrypto_words;

ALTER TABLE fib_word_packs_next RENAME TO fib_word_packs;

ALTER TABLE undercover_word_packs_next RENAME TO undercover_word_packs;

ALTER TABLE drawguess_word_packs_next RENAME TO drawguess_word_packs;

ALTER TABLE decrypto_word_packs_next RENAME TO decrypto_word_packs;

ALTER TABLE fib_word_provider_requests_next RENAME TO fib_word_provider_requests;

ALTER TABLE fib_word_usages_next RENAME TO fib_word_usages;

ALTER TABLE fib_round_word_selections_next RENAME TO fib_round_word_selections;

ALTER TABLE undercover_round_word_selections_next RENAME TO undercover_round_word_selections;

CREATE INDEX idx_fib_words_generation_cycle ON fib_words(generation_cycle_id);

CREATE INDEX idx_fib_words_selection ON fib_words(status, category, selection_key, id);

CREATE INDEX idx_undercover_word_pairs_category ON undercover_word_pairs(status, category);

CREATE UNIQUE INDEX idx_undercover_word_pairs_draw_ordinal ON undercover_word_pairs(draw_ordinal);

CREATE INDEX idx_drawguess_words_category_status ON drawguess_words(category, status);

CREATE UNIQUE INDEX idx_drawguess_words_draw_ordinal ON drawguess_words(draw_ordinal);

CREATE INDEX idx_drawguess_words_status ON drawguess_words(status);

CREATE INDEX idx_decrypto_words_active ON decrypto_words(status, id);

CREATE INDEX idx_decrypto_words_category_created ON decrypto_words(category, created_at DESC, word);

CREATE INDEX idx_fib_word_packs_category_created
  ON fib_word_packs(category, search_selected_at);

CREATE INDEX idx_fib_word_packs_month ON fib_word_packs(month_id);

CREATE INDEX idx_undercover_word_packs_category_created ON undercover_word_packs(category, created_at);

CREATE INDEX idx_undercover_word_packs_created ON undercover_word_packs(created_at);

CREATE INDEX idx_drawguess_word_packs_category_created ON drawguess_word_packs(category, created_at);

CREATE INDEX idx_drawguess_word_packs_created ON drawguess_word_packs(created_at);

CREATE INDEX idx_decrypto_word_packs_created ON decrypto_word_packs(created_at);

CREATE INDEX idx_fib_word_usages_retention ON fib_word_usages(used_at);

CREATE INDEX idx_fib_word_usages_word_used ON fib_word_usages(word_id, used_at);

CREATE INDEX idx_fib_round_word_selections_word ON fib_round_word_selections(word_id, selected_at);

CREATE INDEX idx_undercover_selections_history ON undercover_round_word_selections(room_id, room_creation_id, word_pair_id);

CREATE TRIGGER drawguess_words_draw_delete
AFTER DELETE ON drawguess_words
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'drawguess' AND partition_key = 'all';
END;

CREATE TRIGGER drawguess_words_draw_insert
AFTER INSERT ON drawguess_words
BEGIN
  UPDATE word_draw_ordinals SET last_ordinal = last_ordinal + 1 WHERE pool = 'drawguess';
  UPDATE drawguess_words
  SET draw_ordinal = (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'drawguess')
  WHERE id = NEW.id;
  UPDATE word_draw_index
  SET members = members || (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'drawguess') || ','
  WHERE pool = 'drawguess' AND partition_key = 'all' AND NEW.status = 'active';
END;

CREATE TRIGGER drawguess_words_draw_ordinal_immutable
BEFORE UPDATE OF draw_ordinal ON drawguess_words
WHEN OLD.draw_ordinal IS NOT NULL AND NEW.draw_ordinal IS NOT OLD.draw_ordinal
BEGIN
  SELECT RAISE(ABORT, 'drawguess_words.draw_ordinal is immutable');
END;

CREATE TRIGGER drawguess_words_draw_update
AFTER UPDATE OF status ON drawguess_words
WHEN NEW.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'drawguess' AND partition_key = 'all';
  UPDATE word_draw_index
  SET members = members || NEW.draw_ordinal || ','
  WHERE pool = 'drawguess' AND partition_key = 'all' AND NEW.status = 'active';
END;

CREATE TRIGGER fib_word_sequence_draw_insert
AFTER INSERT ON fib_word_sequence
BEGIN
  UPDATE word_draw_index
  SET members = members || NEW.id || ','
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_words WHERE word = NEW.word AND status = 'active')
    AND instr(members, ',' || NEW.id || ',') = 0;
END;

CREATE TRIGGER fib_words_draw_delete
AFTER DELETE ON fib_words
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = OLD.word) || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = OLD.word);
END;

CREATE TRIGGER fib_words_draw_insert
AFTER INSERT ON fib_words
WHEN NEW.status = 'active'
BEGIN
  UPDATE word_draw_index
  SET members = members || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ','
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = NEW.word)
    AND instr(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ',') = 0;
END;

CREATE TRIGGER fib_words_draw_update
AFTER UPDATE OF status, word ON fib_words
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = OLD.word) || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = OLD.word);
  UPDATE word_draw_index
  SET members = members || (SELECT id FROM fib_word_sequence WHERE word = NEW.word) || ','
  WHERE pool = 'fibking' AND partition_key = 'all' AND NEW.status = 'active'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = NEW.word);
END;

CREATE TRIGGER undercover_word_pairs_draw_delete
AFTER DELETE ON undercover_word_pairs
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'undercover' AND partition_key IN ('all', OLD.category);
END;

CREATE TRIGGER undercover_word_pairs_draw_insert
AFTER INSERT ON undercover_word_pairs
BEGIN
  UPDATE word_draw_ordinals SET last_ordinal = last_ordinal + 1 WHERE pool = 'undercover';
  UPDATE undercover_word_pairs
  SET draw_ordinal = (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'undercover')
  WHERE id = NEW.id;
  UPDATE word_draw_index
  SET members = members || (SELECT last_ordinal FROM word_draw_ordinals WHERE pool = 'undercover') || ','
  WHERE pool = 'undercover' AND partition_key IN ('all', NEW.category) AND NEW.status = 'active';
END;

CREATE TRIGGER undercover_word_pairs_draw_ordinal_immutable
BEFORE UPDATE OF draw_ordinal ON undercover_word_pairs
WHEN OLD.draw_ordinal IS NOT NULL AND NEW.draw_ordinal IS NOT OLD.draw_ordinal
BEGIN
  SELECT RAISE(ABORT, 'undercover_word_pairs.draw_ordinal is immutable');
END;

CREATE TRIGGER undercover_word_pairs_draw_update
AFTER UPDATE OF status, category ON undercover_word_pairs
WHEN NEW.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'undercover' AND partition_key IN ('all', OLD.category);
  UPDATE word_draw_index
  SET members = members || NEW.draw_ordinal || ','
  WHERE pool = 'undercover' AND partition_key IN ('all', NEW.category) AND NEW.status = 'active';
END;

