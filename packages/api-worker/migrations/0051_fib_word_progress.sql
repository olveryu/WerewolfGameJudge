CREATE TABLE fib_word_sequence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL,
  pack_id TEXT
);
CREATE INDEX idx_fib_word_sequence_pack ON fib_word_sequence(pack_id);

CREATE TABLE fib_word_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0)
);

ALTER TABLE fib_round_word_selections ADD COLUMN sequence_number INTEGER;
ALTER TABLE fib_round_word_selections ADD COLUMN participant_user_ids TEXT NOT NULL DEFAULT '[]';

INSERT INTO fib_word_sequence (word, published_at)
SELECT word, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (
  SELECT word FROM fib_words
  UNION SELECT word FROM fib_word_usages
  UNION SELECT word FROM fib_word_exposures
  UNION SELECT word FROM fib_round_word_selections
  UNION SELECT word FROM fib_word_candidate_reviews
) ORDER BY word;

INSERT INTO fib_word_progress (user_id, sequence_number)
SELECT DISTINCT account.id, (SELECT MAX(id) FROM fib_word_sequence)
FROM users AS account
INNER JOIN fib_word_exposures AS exposure ON exposure.user_id = account.id
WHERE EXISTS (SELECT 1 FROM fib_word_sequence);

CREATE TABLE database_capacity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  state TEXT NOT NULL CHECK (state IN ('normal', 'warning', 'paused', 'protected')),
  measured_at TEXT NOT NULL
);
INSERT INTO database_capacity VALUES (1, 0, 'normal', '1970-01-01T00:00:00.000Z');

CREATE TABLE fib_word_supply_months (
  id TEXT PRIMARY KEY,
  requests_reserved INTEGER NOT NULL DEFAULT 0 CHECK (requests_reserved >= 0),
  published_count INTEGER NOT NULL DEFAULT 0 CHECK (published_count >= 0)
);
CREATE TABLE fib_word_packs (
  id TEXT PRIMARY KEY,
  month_id TEXT NOT NULL REFERENCES fib_word_supply_months(id),
  request_token TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('literary', 'internet', 'compound', 'niche')),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  source_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX idx_fib_word_packs_month ON fib_word_packs(month_id);
CREATE TABLE fib_word_provider_requests (
  pack_id TEXT NOT NULL REFERENCES fib_word_packs(id),
  operation TEXT NOT NULL,
  PRIMARY KEY (pack_id, operation)
);
CREATE INDEX idx_fib_word_reviews_retention ON fib_word_candidate_reviews(reviewed_at);
CREATE INDEX idx_fib_word_usages_retention ON fib_word_usages(used_at);