-- Endorsement gate: a human approval step before model review.
-- New item status 'approved' (endorsed, awaiting review) and new action 'endorse'.
-- 'review' no longer accepts 'pending'; 'approve' keeps its skip-review fast path.
-- Identity-level dedup at validate time needs (game, identity, status) indexed.
--
-- Foreign-key note: word_submission_events references both tables rebuilt below
-- (0076: action_id REFERENCES word_submission_actions(id), item_id REFERENCES
-- word_submission_items(id)), and production already holds event rows, so DROP TABLE
-- on either parent fails while the child still references it. D1 applies each
-- migration in a transaction where PRAGMA foreign_keys = OFF is a no-op, so the
-- pragma cannot help (same failure mode as the fib_word_packs DROP avoided in
-- 0080). This migration therefore rebuilds events twice: first without REFERENCES
-- so the parents can be dropped, then again with the 0076 REFERENCES restored, so
-- the final schema matches 0076 plus the new status/action values. Event rows and
-- the AUTOINCREMENT sequence are preserved across both rebuilds (0077 precedent).
-- Never delete event rows to make the DROP pass; the audit trail must survive.

-- Step 1: rebuild word_submission_events WITHOUT foreign keys.
CREATE TABLE word_submission_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL,
  item_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('shared-admin', 'review-workflow')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO word_submission_events_next
  SELECT * FROM word_submission_events;
UPDATE sqlite_sequence SET seq = MAX(seq, (
  SELECT seq FROM sqlite_sequence WHERE name = 'word_submission_events'
)) WHERE name = 'word_submission_events_next';
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'word_submission_events_next', seq FROM sqlite_sequence
  WHERE name = 'word_submission_events'
    AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'word_submission_events_next');
DROP TABLE word_submission_events;
ALTER TABLE word_submission_events_next RENAME TO word_submission_events;
CREATE INDEX idx_word_submission_events_action ON word_submission_events(action_id, id);
CREATE INDEX idx_word_submission_events_item ON word_submission_events(item_id, id);

-- Step 2: rebuild word_submission_items with 'approved' in the status CHECK.
DROP TRIGGER IF EXISTS word_submission_items_insert;
DROP TRIGGER IF EXISTS word_submission_items_status_counts;
DROP TRIGGER IF EXISTS word_submission_items_close;
CREATE TABLE word_submission_items_next (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches(id),
  game TEXT NOT NULL CHECK (game IN ('fibking', 'undercover', 'drawguess')),
  client_item_id TEXT NOT NULL,
  identity TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  status TEXT NOT NULL CHECK (status IN (
    'pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed',
    'published', 'dismissed', 'unpublished', 'duplicate'
  )),
  duplicate_of TEXT,
  review_id TEXT,
  review_version TEXT,
  review_model TEXT,
  review_json TEXT CHECK (review_json IS NULL OR json_valid(review_json)),
  verified_material_json TEXT CHECK (verified_material_json IS NULL OR json_valid(verified_material_json)),
  failure TEXT,
  approval_reason TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  publication_action_id TEXT,
  UNIQUE (batch_id, client_item_id)
);
INSERT INTO word_submission_items_next
  SELECT * FROM word_submission_items;
DROP TABLE word_submission_items;
ALTER TABLE word_submission_items_next RENAME TO word_submission_items;
CREATE INDEX idx_word_submission_items_batch ON word_submission_items(batch_id, status);
CREATE INDEX idx_word_submission_items_content ON word_submission_items(game, content_hash, status);
CREATE INDEX idx_word_submission_items_identity ON word_submission_items(game, identity, status);

-- Step 3: rebuild word_submission_actions with 'endorse' in the action CHECK.
CREATE TABLE word_submission_actions_next (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches(id),
  action TEXT NOT NULL CHECK (action IN ('review', 'publish', 'dismiss', 'approve', 'endorse', 'unpublish')),
  request_hash TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applying', 'queued', 'complete', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
INSERT INTO word_submission_actions_next
  SELECT * FROM word_submission_actions;
DROP TABLE word_submission_actions;
ALTER TABLE word_submission_actions_next RENAME TO word_submission_actions;
CREATE INDEX idx_word_submission_actions_batch ON word_submission_actions(batch_id, created_at DESC, id DESC);

-- Step 4: recreate the count triggers with 'approved' counted as awaiting review.
-- An endorsed item still occupies the pending quota until it leaves the live set.
CREATE TRIGGER word_submission_items_insert
AFTER INSERT ON word_submission_items
WHEN NEW.status IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count + 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id);
  UPDATE word_submission_limits SET pending_count = pending_count + 1,
    awaiting_review_count = awaiting_review_count + (NEW.status IN ('pending', 'approved')),
    awaiting_publication_count = awaiting_publication_count + (NEW.status = 'passed'),
    failed_count = failed_count + (NEW.status = 'failed') WHERE id = 1;
END;

CREATE TRIGGER word_submission_items_status_counts
AFTER UPDATE OF status ON word_submission_items
WHEN OLD.status <> NEW.status
BEGIN
  UPDATE word_submission_limits SET
    awaiting_review_count = awaiting_review_count + (NEW.status IN ('pending', 'approved')) - (OLD.status IN ('pending', 'approved')),
    awaiting_publication_count = awaiting_publication_count + (NEW.status = 'passed') - (OLD.status = 'passed'),
    failed_count = failed_count + (NEW.status = 'failed') - (OLD.status = 'failed'),
    published_count = published_count + (NEW.status = 'published') - (OLD.status = 'published')
  WHERE id = 1;
END;

CREATE TRIGGER word_submission_items_close
AFTER UPDATE OF status ON word_submission_items
WHEN OLD.status IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
 AND NEW.status NOT IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count - 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id);
  UPDATE word_submission_limits SET pending_count = pending_count - 1 WHERE id = 1;
END;

-- Step 5: rebuild word_submission_events WITH the 0076 foreign keys restored.
-- Parent rows were preserved by the step 2/3 copies, so every event reference
-- still resolves; the final schema matches 0076 plus the new values.
CREATE TABLE word_submission_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL REFERENCES word_submission_actions(id),
  item_id TEXT REFERENCES word_submission_items(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('shared-admin', 'review-workflow')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO word_submission_events_next
  SELECT * FROM word_submission_events;
UPDATE sqlite_sequence SET seq = MAX(seq, (
  SELECT seq FROM sqlite_sequence WHERE name = 'word_submission_events'
)) WHERE name = 'word_submission_events_next';
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'word_submission_events_next', seq FROM sqlite_sequence
  WHERE name = 'word_submission_events'
    AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'word_submission_events_next');
DROP TABLE word_submission_events;
ALTER TABLE word_submission_events_next RENAME TO word_submission_events;
CREATE INDEX idx_word_submission_events_action ON word_submission_events(action_id, id);
CREATE INDEX idx_word_submission_events_item ON word_submission_events(item_id, id);
