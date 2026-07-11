-- Durable per-user events. Rows remain until the authenticated client acknowledges them.

CREATE TABLE user_event_inbox (
  user_id     TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object'),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_event_inbox_delivery
  ON user_event_inbox(user_id, created_at, event_id);
