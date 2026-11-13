-- Keep submission provenance while removing revoked agents from the visible registry.
ALTER TABLE word_submission_agents ADD COLUMN deleted_at TEXT
  CHECK (deleted_at IS NULL OR status = 'revoked');
CREATE INDEX idx_word_submission_agents_visible
  ON word_submission_agents(created_at DESC, id DESC) WHERE deleted_at IS NULL;

-- Extend the control audit vocabulary, preserving all existing events and triggers.
DROP TRIGGER word_submission_agent_created;
DROP TRIGGER word_submission_credential_issued;
DROP TRIGGER word_submission_agent_status_changed;
DROP TRIGGER word_submission_intake_changed;
CREATE TABLE word_submission_control_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES word_submission_agents(id),
  action TEXT NOT NULL CHECK (action IN (
    'agent_created', 'credential_issued', 'agent_status_changed', 'intake_changed',
    'agent_updated', 'credential_expiry_changed', 'agent_deleted'
  )),
  actor TEXT NOT NULL CHECK (actor = 'shared-admin'),
  details_json TEXT NOT NULL CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);
INSERT INTO word_submission_control_events_next
  SELECT * FROM word_submission_control_events;
UPDATE sqlite_sequence SET seq = MAX(seq, (
  SELECT seq FROM sqlite_sequence WHERE name = 'word_submission_control_events'
)) WHERE name = 'word_submission_control_events_next';
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'word_submission_control_events_next', seq FROM sqlite_sequence
  WHERE name = 'word_submission_control_events'
    AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'word_submission_control_events_next');
DROP TABLE word_submission_control_events;
ALTER TABLE word_submission_control_events_next RENAME TO word_submission_control_events;

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
CREATE TRIGGER word_submission_agent_updated
AFTER UPDATE OF name, description, games_json, daily_quota, pending_quota ON word_submission_agents
WHEN OLD.name <> NEW.name OR OLD.description <> NEW.description OR OLD.games_json <> NEW.games_json
  OR OLD.daily_quota <> NEW.daily_quota OR OLD.pending_quota <> NEW.pending_quota
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.id, 'agent_updated', 'shared-admin',
    json_object(
      'before', json_object('name', OLD.name, 'description', OLD.description, 'games', json(OLD.games_json),
        'dailyQuota', OLD.daily_quota, 'pendingQuota', OLD.pending_quota),
      'after', json_object('name', NEW.name, 'description', NEW.description, 'games', json(NEW.games_json),
        'dailyQuota', NEW.daily_quota, 'pendingQuota', NEW.pending_quota)),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER word_submission_credential_expiry_changed
AFTER UPDATE OF expires_at ON word_submission_credentials
WHEN OLD.expires_at <> NEW.expires_at
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.agent_id, 'credential_expiry_changed', 'shared-admin',
    json_object('credentialId', NEW.id, 'from', OLD.expires_at, 'to', NEW.expires_at),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER word_submission_agent_deleted
AFTER UPDATE OF deleted_at ON word_submission_agents
WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
BEGIN
  INSERT INTO word_submission_control_events (agent_id, action, actor, details_json, created_at)
  VALUES (NEW.id, 'agent_deleted', 'shared-admin', '{}', NEW.deleted_at);
END;
