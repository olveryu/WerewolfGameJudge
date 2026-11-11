-- Expand the published-pair category constraint without changing existing
-- ordinals, snapshots, or the shared seen/index records.
PRAGMA defer_foreign_keys = true;

CREATE TABLE undercover_word_pairs_next (
  id TEXT PRIMARY KEY,
  word_a TEXT NOT NULL CHECK (length(trim(word_a)) > 0),
  word_b TEXT NOT NULL CHECK (length(trim(word_b)) > 0 AND word_a < word_b),
  category TEXT NOT NULL CHECK (category IN (
    'food', 'dailyLife', 'school', 'work', 'relationships', 'actions',
    'entertainment', 'sportsAndGames', 'travel', 'nature', 'drinks',
    'desserts', 'cooking', 'clothing', 'beauty', 'home', 'pets', 'animals',
    'plants', 'weather', 'vehicles', 'shopping', 'technology', 'music',
    'filmAndTelevision', 'festivals', 'occupations', 'health', 'hobbies', 'outdoors'
  )),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  review_json TEXT NOT NULL CHECK (json_valid(review_json)),
  draw_ordinal INTEGER,
  UNIQUE (word_a, word_b)
);
INSERT INTO undercover_word_pairs_next SELECT * FROM undercover_word_pairs;

CREATE TABLE undercover_round_word_selections_next (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
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
INSERT INTO undercover_round_word_selections_next SELECT * FROM undercover_round_word_selections;

DROP TABLE undercover_round_word_selections;
DROP TABLE undercover_word_pairs;
ALTER TABLE undercover_word_pairs_next RENAME TO undercover_word_pairs;
ALTER TABLE undercover_round_word_selections_next RENAME TO undercover_round_word_selections;
CREATE INDEX idx_undercover_word_pairs_category ON undercover_word_pairs(status, category);
CREATE UNIQUE INDEX idx_undercover_word_pairs_draw_ordinal ON undercover_word_pairs(draw_ordinal);
CREATE INDEX idx_undercover_selections_history ON undercover_round_word_selections(room_id, room_creation_id, word_pair_id);

INSERT INTO word_draw_index (pool, partition_key, members)
SELECT 'undercover', value, ',' FROM json_each(
  '["drinks","desserts","cooking","clothing","beauty","home","pets","animals","plants","weather","vehicles","shopping","technology","music","filmAndTelevision","festivals","occupations","health","hobbies","outdoors"]'
);

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

CREATE TRIGGER undercover_word_pairs_draw_delete
AFTER DELETE ON undercover_word_pairs
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'undercover' AND partition_key IN ('all', OLD.category);
END;

CREATE TRIGGER undercover_word_pairs_draw_ordinal_immutable
BEFORE UPDATE OF draw_ordinal ON undercover_word_pairs
WHEN OLD.draw_ordinal IS NOT NULL AND NEW.draw_ordinal IS NOT OLD.draw_ordinal
BEGIN
  SELECT RAISE(ABORT, 'undercover_word_pairs.draw_ordinal is immutable');
END;

PRAGMA defer_foreign_keys = false;
