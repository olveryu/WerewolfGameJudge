-- Candidate dismissal audit: one row per dismissed candidate, grouped by the
-- dismiss request that dismissed them. Mirrors word_candidate_approvals
-- (0080): candidates and external submissions are separate tables, so each
-- keeps its own audit. A dismissed candidate is deleted from its queue
-- table (fib candidates hold no terminal review state, and no table
-- references a candidate row), so the audit row is the only record of why
-- it was thrown out.
CREATE TABLE word_candidate_dismissals (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('fibking', 'undercover', 'drawguess')),
  candidate_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_word_candidate_dismissals_request
  ON word_candidate_dismissals(request_id, created_at);
