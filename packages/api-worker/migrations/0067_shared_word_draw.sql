-- Shared word draw for fibking, undercover and drawguess.
--
-- One draw mechanism serves the three word games. Each game keeps its own
-- word table; the shared layer only knows integer ordinals:
--   - word_draw_index: the drawable ordinals of a pool partition, one row each.
--   - word_seen: the ordinals one account has seen in a pool, one row each.
-- A draw therefore reads one index row plus one row per participant instead
-- of scanning the word table (ORDER BY random() read every active word twice).
--
-- Ordinal lists are comma-delimited with a leading and trailing comma
-- (",3,17,42,"), so a token can be appended or removed with plain string
-- functions and no row scan. word_seen also accepts inclusive ranges
-- (",1-250,"), which is how the fibking high-watermark is carried over.
--
-- Ordinals are stable and never reused. fibking uses fib_word_sequence.id;
-- undercover and drawguess get a draw_ordinal column fed by a counter.
-- Triggers keep word_draw_index in step with every write path (publication,
-- re-review, seeds, fixtures), so no caller maintains it by hand.

CREATE TABLE word_draw_ordinals (
  pool TEXT PRIMARY KEY CHECK (pool IN ('undercover', 'drawguess')), -- Counter-fed pools; fibking numbers come from fib_word_sequence.
  last_ordinal INTEGER NOT NULL CHECK (last_ordinal >= 0) -- Highest ordinal ever issued; only grows.
) WITHOUT ROWID;

CREATE TABLE word_draw_index (
  pool TEXT NOT NULL CHECK (pool IN ('fibking', 'undercover', 'drawguess')), -- Word source; never shared between games.
  partition_key TEXT NOT NULL CHECK (length(partition_key) > 0), -- 'all', or an undercover category.
  members TEXT NOT NULL DEFAULT ',' CHECK (members GLOB ',*' AND substr(members, -1) = ','), -- Drawable ordinals, e.g. ",3,17,42,".
  PRIMARY KEY (pool, partition_key)
) WITHOUT ROWID;

-- user_id leads the key so deleting an account finds its rows by index.
CREATE TABLE word_seen (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool TEXT NOT NULL CHECK (pool IN ('fibking', 'undercover', 'drawguess')),
  seen TEXT NOT NULL CHECK (seen GLOB ',*' AND substr(seen, -1) = ','), -- Seen ordinals and inclusive ranges, e.g. ",1-250,263,301,".
  PRIMARY KEY (user_id, pool)
) WITHOUT ROWID;

-- ── fibking ────────────────────────────────────────────────────────────────
-- The per-account high-watermark becomes "every ordinal up to the watermark
-- is seen": nobody regains a question they may have had, nobody loses one.
--
-- fib_word_progress and fib_word_exposures are left in place on purpose.
-- Migrations run before the Worker deploy, so the previous Worker still reads
-- fib_word_progress until the new one is live, and a rollback keeps working.
-- A follow-up migration drops both once no deployed code reads them.
INSERT INTO word_seen (user_id, pool, seen)
SELECT user_id, 'fibking', ',1-' || sequence_number || ',' FROM fib_word_progress;

INSERT INTO word_draw_index (pool, partition_key, members)
VALUES (
  'fibking',
  'all',
  ',' || COALESCE((
    SELECT group_concat(sequence.id, ',') || ','
    FROM fib_word_sequence AS sequence
    INNER JOIN fib_words AS word ON word.word = sequence.word
    WHERE word.status = 'active'
  ), '')
);

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

-- ── undercover ─────────────────────────────────────────────────────────────
ALTER TABLE undercover_word_pairs ADD COLUMN draw_ordinal INTEGER; -- Trigger-assigned, stable, never reused.
UPDATE undercover_word_pairs SET draw_ordinal = rowid;
CREATE UNIQUE INDEX idx_undercover_word_pairs_draw_ordinal ON undercover_word_pairs(draw_ordinal);

INSERT INTO word_draw_ordinals (pool, last_ordinal)
SELECT 'undercover', COALESCE(MAX(draw_ordinal), 0) FROM undercover_word_pairs;

INSERT INTO word_draw_index (pool, partition_key, members)
SELECT
  'undercover',
  slot.value,
  ',' || COALESCE((
    SELECT group_concat(pair.draw_ordinal, ',') || ','
    FROM undercover_word_pairs AS pair
    WHERE pair.status = 'active' AND (slot.value = 'all' OR pair.category = slot.value)
  ), '')
FROM json_each('["all","food","dailyLife","school","work","relationships","actions","entertainment","sportsAndGames","travel","nature"]') AS slot;

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

-- ── drawguess ──────────────────────────────────────────────────────────────
ALTER TABLE drawguess_words ADD COLUMN draw_ordinal INTEGER; -- Trigger-assigned, stable, never reused.
UPDATE drawguess_words SET draw_ordinal = rowid;
CREATE UNIQUE INDEX idx_drawguess_words_draw_ordinal ON drawguess_words(draw_ordinal);

INSERT INTO word_draw_ordinals (pool, last_ordinal)
SELECT 'drawguess', COALESCE(MAX(draw_ordinal), 0) FROM drawguess_words;

INSERT INTO word_draw_index (pool, partition_key, members)
VALUES (
  'drawguess',
  'all',
  ',' || COALESCE((
    SELECT group_concat(draw_ordinal, ',') || ',' FROM drawguess_words WHERE status = 'active'
  ), '')
);

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

CREATE TRIGGER drawguess_words_draw_delete
AFTER DELETE ON drawguess_words
WHEN OLD.draw_ordinal IS NOT NULL
BEGIN
  UPDATE word_draw_index
  SET members = replace(members, ',' || OLD.draw_ordinal || ',', ',')
  WHERE pool = 'drawguess' AND partition_key = 'all';
END;

CREATE TRIGGER drawguess_words_draw_ordinal_immutable
BEFORE UPDATE OF draw_ordinal ON drawguess_words
WHEN OLD.draw_ordinal IS NOT NULL AND NEW.draw_ordinal IS NOT OLD.draw_ordinal
BEGIN
  SELECT RAISE(ABORT, 'drawguess_words.draw_ordinal is immutable');
END;
