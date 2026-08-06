-- Old Fib rooms are intentionally unsupported by state v4, so discard their AI result cache.

DROP TABLE fib_word_generation_results;

CREATE TABLE fib_word_generation_results (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL CHECK (length(room_creation_id) > 0),
  effect_id TEXT NOT NULL CHECK (length(effect_id) > 0),
  round_id TEXT NOT NULL CHECK (length(round_id) > 0),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  catalog_entry_id TEXT NOT NULL CHECK (length(catalog_entry_id) > 0),
  catalog_version INTEGER NOT NULL CHECK (catalog_version > 0),
  word TEXT NOT NULL CHECK (
    length(word) BETWEEN 2 AND 12
    AND word = trim(word)
  ),
  core_meaning TEXT NOT NULL CHECK (length(trim(core_meaning)) BETWEEN 1 AND 240),
  usage_note TEXT NOT NULL CHECK (length(trim(usage_note)) BETWEEN 1 AND 240),
  created_at TEXT NOT NULL,
  PRIMARY KEY (room_id, effect_id)
);

CREATE UNIQUE INDEX idx_fib_word_generation_results_room_round
  ON fib_word_generation_results(room_id, round_id);
CREATE INDEX idx_fib_word_generation_results_created
  ON fib_word_generation_results(created_at);