-- 0026: Feedback conversations — bidirectional feedback via GitHub Issues
-- Stores user feedback with GitHub Issue mapping and admin/user replies.

CREATE TABLE feedbacks (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_issue_number  INTEGER NOT NULL,
  content              TEXT NOT NULL,
  app_version          TEXT NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE UNIQUE INDEX idx_feedbacks_github_issue_number ON feedbacks(github_issue_number);

CREATE TABLE feedback_replies (
  id                 TEXT PRIMARY KEY,
  feedback_id        TEXT NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  is_admin           INTEGER NOT NULL DEFAULT 0,
  body               TEXT NOT NULL,
  github_comment_id  INTEGER,
  is_read            INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedback_replies_feedback_id ON feedback_replies(feedback_id);
CREATE UNIQUE INDEX idx_feedback_replies_github_comment_id
  ON feedback_replies(github_comment_id) WHERE github_comment_id IS NOT NULL;
