-- Keep a bounded per-user history of FibKing words that reached an authoritative round.

CREATE TABLE fib_word_exposures (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word TEXT NOT NULL CHECK (length(trim(word)) BETWEEN 2 AND 12),
  last_seen_at TEXT NOT NULL CHECK (length(last_seen_at) > 0),
  PRIMARY KEY (user_id, word)
);

CREATE INDEX idx_fib_word_exposures_user_seen
  ON fib_word_exposures(user_id, last_seen_at DESC);