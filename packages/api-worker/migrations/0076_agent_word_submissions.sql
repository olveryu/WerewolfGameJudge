-- External material is deliberately separate from every automatic editorial queue.
CREATE TABLE word_submission_limits (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  accepting INTEGER NOT NULL DEFAULT 1 CHECK (accepting IN (0, 1)),
  awaiting_review_count INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_review_count >= 0),
  awaiting_publication_count INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_publication_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  published_count INTEGER NOT NULL DEFAULT 0 CHECK (published_count >= 0),
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count BETWEEN 0 AND 5000),
  submission_day TEXT NOT NULL DEFAULT '',
  submitted_today INTEGER NOT NULL DEFAULT 0 CHECK (submitted_today BETWEEN 0 AND 1000)
);
INSERT INTO word_submission_limits (id) VALUES (1);

CREATE TABLE word_submission_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  games_json TEXT NOT NULL CHECK (json_valid(games_json)),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'revoked')),
  daily_quota INTEGER NOT NULL CHECK (daily_quota BETWEEN 1 AND 1000),
  pending_quota INTEGER NOT NULL CHECK (pending_quota BETWEEN 1 AND 1000),
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count >= 0 AND pending_count <= pending_quota),
  current_credential_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_word_submission_agents_created ON word_submission_agents(created_at DESC, id DESC);

CREATE TABLE word_submission_credentials (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES word_submission_agents(id),
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_word_submission_credentials_agent ON word_submission_credentials(agent_id, created_at DESC, id DESC);

CREATE TABLE word_submission_daily_usage (
  agent_id TEXT NOT NULL REFERENCES word_submission_agents(id),
  day TEXT NOT NULL,
  submitted_count INTEGER NOT NULL CHECK (submitted_count >= 0),
  PRIMARY KEY (agent_id, day)
);

CREATE TABLE word_submission_batches (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES word_submission_agents(id),
  game TEXT NOT NULL CHECK (game IN ('fibking', 'undercover', 'drawguess')),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (agent_id, idempotency_key)
);
CREATE VIRTUAL TABLE word_submission_search USING fts5(game, agent, search_text, statuses);

CREATE TABLE word_submission_items (
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
    'pending', 'reviewing', 'passed', 'rejected', 'failed',
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
CREATE INDEX idx_word_submission_items_batch ON word_submission_items(batch_id, status);
CREATE INDEX idx_word_submission_items_content ON word_submission_items(game, content_hash, status);

CREATE TABLE word_submission_actions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES word_submission_batches(id),
  action TEXT NOT NULL CHECK (action IN ('review', 'publish', 'dismiss', 'approve', 'unpublish')),
  request_hash TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applying', 'queued', 'complete', 'failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_word_submission_actions_batch ON word_submission_actions(batch_id, created_at DESC, id DESC);

CREATE TABLE word_submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_id TEXT NOT NULL REFERENCES word_submission_actions(id),
  item_id TEXT REFERENCES word_submission_items(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('shared-admin', 'review-workflow')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_word_submission_events_action ON word_submission_events(action_id, id);
CREATE INDEX idx_word_submission_events_item ON word_submission_events(item_id, id);

CREATE TABLE word_submission_evidence_requests (
  id TEXT PRIMARY KEY,
  claimed_at TEXT NOT NULL
);
CREATE INDEX idx_word_submission_evidence_requests_time ON word_submission_evidence_requests(claimed_at);

CREATE TABLE word_submission_control_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES word_submission_agents(id),
  action TEXT NOT NULL CHECK (action IN (
    'agent_created', 'credential_issued', 'agent_status_changed', 'intake_changed'
  )),
  actor TEXT NOT NULL CHECK (actor = 'shared-admin'),
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);

CREATE TRIGGER word_submission_agent_created
AFTER INSERT ON word_submission_agents
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.id, 'agent_created', 'shared-admin',
    json_object('games', json(NEW.games_json), 'dailyQuota', NEW.daily_quota, 'pendingQuota', NEW.pending_quota),
    NEW.created_at);
END;

CREATE TRIGGER word_submission_credential_issued
AFTER INSERT ON word_submission_credentials
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.agent_id, 'credential_issued', 'shared-admin',
    json_object('credentialId', NEW.id, 'prefix', NEW.prefix, 'expiresAt', NEW.expires_at), NEW.created_at);
END;

CREATE TRIGGER word_submission_agent_status_changed
AFTER UPDATE OF status ON word_submission_agents
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.id, 'agent_status_changed', 'shared-admin',
    json_object('from', OLD.status, 'to', NEW.status), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER word_submission_intake_changed
AFTER UPDATE OF accepting ON word_submission_limits
WHEN OLD.accepting <> NEW.accepting
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NULL, 'intake_changed', 'shared-admin',
    json_object('from', OLD.accepting, 'to', NEW.accepting), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER word_submission_items_insert
AFTER INSERT ON word_submission_items
WHEN NEW.status IN ('pending', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count + 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id);
  UPDATE word_submission_limits SET pending_count = pending_count + 1,
    awaiting_review_count = awaiting_review_count + (NEW.status = 'pending'),
    awaiting_publication_count = awaiting_publication_count + (NEW.status = 'passed'),
    failed_count = failed_count + (NEW.status = 'failed') WHERE id = 1;
END;

CREATE TRIGGER word_submission_items_status_counts
AFTER UPDATE OF status ON word_submission_items
WHEN OLD.status <> NEW.status
BEGIN
  UPDATE word_submission_limits SET
    awaiting_review_count = awaiting_review_count + (NEW.status = 'pending') - (OLD.status = 'pending'),
    awaiting_publication_count = awaiting_publication_count + (NEW.status = 'passed') - (OLD.status = 'passed'),
    failed_count = failed_count + (NEW.status = 'failed') - (OLD.status = 'failed'),
    published_count = published_count + (NEW.status = 'published') - (OLD.status = 'published')
  WHERE id = 1;
END;

CREATE TRIGGER word_submission_items_close
AFTER UPDATE OF status ON word_submission_items
WHEN OLD.status IN ('pending', 'reviewing', 'passed', 'rejected', 'failed')
 AND NEW.status NOT IN ('pending', 'reviewing', 'passed', 'rejected', 'failed')
BEGIN
  UPDATE word_submission_agents SET pending_count = pending_count - 1
    WHERE id = (SELECT agent_id FROM word_submission_batches WHERE id = NEW.batch_id);
  UPDATE word_submission_limits SET pending_count = pending_count - 1 WHERE id = 1;
END;
