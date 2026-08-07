DROP INDEX idx_refresh_tokens_token_hash;
CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

CREATE TABLE refresh_token_rotations (
  token_hash TEXT PRIMARY KEY,
  refresh_token_id TEXT NOT NULL REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  successor_token_hash TEXT NOT NULL,
  rotated_at TEXT NOT NULL
);

CREATE INDEX idx_refresh_token_rotations_refresh_token_id
  ON refresh_token_rotations(refresh_token_id);