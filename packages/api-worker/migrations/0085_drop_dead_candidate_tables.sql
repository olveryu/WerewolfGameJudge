-- Drop the legacy candidate tables. Their foreign keys are outbound
-- (to packs / generation_cycles), and no table references a candidate row
-- (0083 comment), so no parent/child rebuild is needed.

-- This internal principal is deliberately separate from human Agent
-- authorizations. Its synthetic credential is never issued.
DROP TRIGGER word_submission_agent_created;
DROP TRIGGER word_submission_credential_issued;
INSERT OR IGNORE INTO word_submission_agents
  (id, name, description, games_json, status, daily_quota, pending_quota,
   current_credential_id, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', '系统补词', '补词 workflow 生成的投稿',
   '["fibking","undercover","drawguess"]', 'active', 1000, 1000,
   '00000000-0000-4000-8000-000000000002', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
INSERT OR IGNORE INTO word_submission_credentials
  (id, agent_id, token_hash, prefix, expires_at, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   lower(hex(randomblob(32))), 'supply', '2999-01-01T00:00:00.000Z',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
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

-- Generated submissions still count toward the bounded shared review queue,
-- but never consume an external Agent's per-agent pending quota.
DROP TRIGGER word_submission_items_insert;
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
DROP TRIGGER word_submission_items_close;
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

DROP TABLE IF EXISTS fib_word_candidates;
DROP TABLE IF EXISTS undercover_word_candidates;
DROP TABLE IF EXISTS drawguess_word_candidates;
DROP TABLE IF EXISTS fib_word_candidate_reviews;
DROP TABLE IF EXISTS word_candidate_approvals;
DROP TABLE IF EXISTS word_candidate_dismissals;
