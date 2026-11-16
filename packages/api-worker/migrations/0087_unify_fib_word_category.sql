-- The legacy category columns have CHECK constraints, so SQLite cannot DROP
-- them in place. Rebuild Fib words with category as the sole classification.
DROP TRIGGER fib_words_draw_insert;
DROP TRIGGER fib_words_draw_update;
DROP TRIGGER fib_words_draw_delete;
DROP TRIGGER fib_word_sequence_draw_insert;
DROP TRIGGER fib_word_sequence_draw_delete;
DROP INDEX idx_fib_words_selection;
DROP INDEX idx_fib_words_topic;

CREATE TABLE fib_round_word_selections_without_words (
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
  selection_tier TEXT NOT NULL CHECK (selection_tier IN (
    'category_unseen', 'any_unseen', 'category_recent', 'any_active', 'local_fallback'
  )),
  selected_at TEXT NOT NULL,
  sequence_number INTEGER,
  participant_user_ids TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
INSERT INTO fib_round_word_selections_without_words SELECT * FROM fib_round_word_selections;
DROP TABLE fib_round_word_selections;
ALTER TABLE fib_round_word_selections_without_words RENAME TO fib_round_word_selections;
CREATE INDEX idx_fib_round_word_selections_word
  ON fib_round_word_selections(word_id, selected_at);

CREATE TABLE fib_word_usages_without_words (
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  word_id TEXT,
  word TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  used_at TEXT NOT NULL,
  participant_count INTEGER NOT NULL CHECK (participant_count > 0),
  PRIMARY KEY (room_creation_id, round_id)
);
INSERT INTO fib_word_usages_without_words SELECT * FROM fib_word_usages;
DROP TABLE fib_word_usages;
ALTER TABLE fib_word_usages_without_words RENAME TO fib_word_usages;

CREATE TABLE fib_words_next (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  category TEXT,
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
  )
);
INSERT INTO fib_words_next
  (id, word, core_meaning, usage_note, category, source, status, selection_key,
   generation_cycle_id, created_at, activated_at, disabled_at, status_reason)
SELECT id, word, core_meaning, usage_note,
       COALESCE(NULLIF(topic, ''), 'other'),
       source, status, selection_key, generation_cycle_id, created_at, activated_at,
       disabled_at, status_reason
FROM fib_words;
DROP TABLE fib_words;
ALTER TABLE fib_words_next RENAME TO fib_words;
CREATE INDEX idx_fib_words_selection ON fib_words(status, category, selection_key, id);
CREATE INDEX idx_fib_words_generation_cycle ON fib_words(generation_cycle_id);

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
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);
INSERT INTO fib_round_word_selections_next SELECT * FROM fib_round_word_selections;
DROP TABLE fib_round_word_selections;
ALTER TABLE fib_round_word_selections_next RENAME TO fib_round_word_selections;
CREATE INDEX idx_fib_round_word_selections_word
  ON fib_round_word_selections(word_id, selected_at);

CREATE TABLE fib_word_usages_next (
  room_creation_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  word_id TEXT REFERENCES fib_words(id) ON DELETE RESTRICT,
  word TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  used_at TEXT NOT NULL,
  participant_count INTEGER NOT NULL CHECK (participant_count > 0),
  PRIMARY KEY (room_creation_id, round_id)
);
INSERT INTO fib_word_usages_next SELECT * FROM fib_word_usages;
DROP TABLE fib_word_usages;
ALTER TABLE fib_word_usages_next RENAME TO fib_word_usages;
CREATE INDEX idx_fib_word_usages_word_used ON fib_word_usages(word_id, used_at);

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

CREATE TRIGGER fib_words_draw_delete
AFTER DELETE ON fib_words
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || (SELECT id FROM fib_word_sequence WHERE word = OLD.word) || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all'
    AND EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = OLD.word);
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

CREATE TRIGGER fib_word_sequence_draw_delete
AFTER DELETE ON fib_word_sequence
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.id || ',', ',')
  WHERE pool = 'fibking' AND partition_key = 'all';
END;

-- fib_word_provider_requests references packs; temporarily rebuild that child
-- without the FK so the legacy CHECK-constrained pack table can be replaced.
DROP INDEX idx_fib_word_packs_topic_created;
CREATE TABLE fib_word_provider_requests_without_packs (
  pack_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  PRIMARY KEY (pack_id, operation)
);
INSERT INTO fib_word_provider_requests_without_packs SELECT * FROM fib_word_provider_requests;
DROP TABLE fib_word_provider_requests;
ALTER TABLE fib_word_provider_requests_without_packs RENAME TO fib_word_provider_requests;

CREATE TABLE fib_word_packs_next (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL REFERENCES fib_word_supply_months(id),
  request_token TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  source_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  published_at TEXT,
  outcome TEXT CHECK (outcome IN ('noCandidates', 'allRejected', 'reviewed')),
  search_index INTEGER,
  search_selected_at TEXT
);
INSERT INTO fib_word_packs_next
  (id, month_id, request_token, category, status, source_json, created_at, published_at,
   outcome, search_index, search_selected_at)
SELECT id, month_id, request_token, COALESCE(NULLIF(topic, ''), 'other'),
       status, source_json, created_at, published_at, outcome, search_index, search_selected_at
FROM fib_word_packs;
DROP TABLE fib_word_packs;
ALTER TABLE fib_word_packs_next RENAME TO fib_word_packs;
CREATE INDEX idx_fib_word_packs_month ON fib_word_packs(month_id);
CREATE INDEX idx_fib_word_packs_category_created
  ON fib_word_packs(category, search_selected_at);

CREATE TABLE fib_word_provider_requests_next (
  pack_id TEXT NOT NULL REFERENCES fib_word_packs(id),
  operation TEXT NOT NULL,
  PRIMARY KEY (pack_id, operation)
);
INSERT INTO fib_word_provider_requests_next SELECT * FROM fib_word_provider_requests;
DROP TABLE fib_word_provider_requests;
ALTER TABLE fib_word_provider_requests_next RENAME TO fib_word_provider_requests;

UPDATE word_submission_items
SET category = COALESCE(NULLIF(json_extract(material_json, '$.topic'), ''), 'other'),
    material_json = json_set(
      json_remove(material_json, '$.category', '$.topic'),
      '$.category',
      COALESCE(NULLIF(json_extract(material_json, '$.topic'), ''), 'other')
    )
WHERE game = 'fibking';
