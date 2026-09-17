CREATE TABLE feedback_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_id TEXT REFERENCES feedbacks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('issue', 'reply')),
  request_json TEXT NOT NULL,
  content TEXT NOT NULL,
  app_version TEXT NOT NULL,
  title TEXT NOT NULL,
  github_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uncertain', 'needs_review', 'synced')),
  remote_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_feedback_deliveries_user_status ON feedback_deliveries(user_id, status);