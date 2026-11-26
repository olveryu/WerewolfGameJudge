-- Word submission catalog foreign keys.
--
-- word_submission_batches/items.game drop their CHECK lists and reference word_games(game);
-- word_submission_items adds FOREIGN KEY (game, category) → word_categories(game, id).
-- Foreign-key descendants (production schema): batches ← items, actions; items ← events;
-- actions ← events (all NO ACTION), so the four tables are rebuilt together; agents is a parent
-- and is not rebuilt. The three counting triggers on items are dropped and recreated verbatim.
-- events is AUTOINCREMENT: the 0092 sqlite_sequence carry-over keeps ids monotonic.

PRAGMA defer_foreign_keys = true;

DROP TRIGGER word_submission_items_close;

DROP TRIGGER word_submission_items_insert;

DROP TRIGGER word_submission_items_status_counts;

CREATE TABLE word_submission_batches_next (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES word_submission_agents(id),
  game TEXT NOT NULL REFERENCES word_games(game),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (agent_id, idempotency_key)
);

CREATE TABLE word_submission_items_next (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches_next(id),
  game TEXT NOT NULL REFERENCES word_games(game),
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
  UNIQUE (batch_id, client_item_id),
  FOREIGN KEY (game, category) REFERENCES word_categories(game, id)
);

CREATE TABLE word_submission_actions_next (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches_next(id),
  action TEXT NOT NULL CHECK (action IN (
    'review', 'publish', 'dismiss', 'approve', 'endorse', 'unendorse', 'unpublish'
  )),
  request_hash TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applying', 'queued', 'complete', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE word_submission_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL REFERENCES word_submission_actions_next(id),
  item_id TEXT REFERENCES word_submission_items_next(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('shared-admin', 'review-workflow')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO word_submission_batches_next (id, agent_id, game, idempotency_key, request_hash, created_at) SELECT id, agent_id, game, idempotency_key, request_hash, created_at FROM word_submission_batches;

INSERT INTO word_submission_items_next (id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status, duplicate_of, review_id, review_version, review_model, review_json, verified_material_json, failure, approval_reason, revision, publication_action_id) SELECT id, batch_id, game, client_item_id, identity, content_hash, title, category, material_json, status, duplicate_of, review_id, review_version, review_model, review_json, verified_material_json, failure, approval_reason, revision, publication_action_id FROM word_submission_items;

INSERT INTO word_submission_actions_next (id, batch_id, action, request_hash, items_json, reason, status, created_at, completed_at) SELECT id, batch_id, action, request_hash, items_json, reason, status, created_at, completed_at FROM word_submission_actions;

INSERT INTO word_submission_events_next (id, action_id, item_id, action, actor, reason, created_at) SELECT id, action_id, item_id, action, actor, reason, created_at FROM word_submission_events;

UPDATE sqlite_sequence SET seq = MAX(seq, (
  SELECT seq FROM sqlite_sequence WHERE name = 'word_submission_events'
)) WHERE name = 'word_submission_events_next';
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'word_submission_events_next', seq FROM sqlite_sequence
  WHERE name = 'word_submission_events'
    AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'word_submission_events_next');

DROP TABLE word_submission_events;

DROP TABLE word_submission_actions;

DROP TABLE word_submission_items;

DROP TABLE word_submission_batches;

ALTER TABLE word_submission_batches_next RENAME TO word_submission_batches;

ALTER TABLE word_submission_items_next RENAME TO word_submission_items;

ALTER TABLE word_submission_actions_next RENAME TO word_submission_actions;

ALTER TABLE word_submission_events_next RENAME TO word_submission_events;

CREATE INDEX idx_word_submission_items_batch ON word_submission_items(batch_id, status);

CREATE INDEX idx_word_submission_items_content ON word_submission_items(game, content_hash, status);

CREATE INDEX idx_word_submission_items_identity ON word_submission_items(game, identity, status);

CREATE INDEX idx_word_submission_actions_batch
  ON word_submission_actions(batch_id, created_at DESC, id DESC);

CREATE INDEX idx_word_submission_events_action ON word_submission_events(action_id, id);

CREATE INDEX idx_word_submission_events_item ON word_submission_events(item_id, id);

CREATE TRIGGER word_submission_items_close
AFTER UPDATE OF status ON word_submission_items
WHEN OLD.status IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
 AND NEW.status NOT IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count - 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id)
      AND id <> '00000000-0000-4000-8000-000000000001';
  UPDATE word_submission_limits SET pending_count = pending_count - 1 WHERE id = 1;
END;

CREATE TRIGGER word_submission_items_insert
AFTER INSERT ON word_submission_items
WHEN NEW.status IN ('pending', 'approved', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count + 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id)
      AND id <> '00000000-0000-4000-8000-000000000001';
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

