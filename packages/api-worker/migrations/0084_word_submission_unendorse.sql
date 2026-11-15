-- Withdraw endorsement: new action 'unendorse' (approved -> pending).
-- Only word_submission_actions carries an action CHECK; the events table's
-- action column has none (0076), and no item status changes, so no item
-- rebuild and no trigger changes are needed: approved and pending are both
-- live states, so the 0079 count triggers treat the move symmetrically.
--
-- Foreign-key note (0079 precedent): word_submission_events references
-- word_submission_actions, so DROP TABLE on the parent fails while the
-- child still references it, and D1 applies each migration in a transaction
-- where PRAGMA foreign_keys = OFF is a no-op. Rebuild events without
-- REFERENCES first, then the actions table, then events with the 0076
-- REFERENCES restored. Event rows and the AUTOINCREMENT sequence are
-- preserved across both rebuilds. Never delete event rows to make the
-- DROP pass; the audit trail must survive.

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

-- Step 2: rebuild word_submission_actions with 'unendorse' in the action CHECK.
CREATE TABLE word_submission_actions_next (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches(id),
  action TEXT NOT NULL CHECK (action IN ('review', 'publish', 'dismiss', 'approve', 'endorse', 'unendorse', 'unpublish')),
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

-- Step 3: rebuild word_submission_events WITH the 0076 foreign keys restored.
-- Parent rows were preserved by the step 2 copy, so every event reference
-- still resolves; the final schema matches 0076 plus the new action value.
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
