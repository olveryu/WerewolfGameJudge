-- Memoize exact nondeterministic FibKing provider results for at-least-once effect delivery.

CREATE TABLE fib_word_generation_results (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL CHECK (length(room_creation_id) > 0),
  effect_id TEXT NOT NULL CHECK (length(effect_id) > 0),
  round_id TEXT NOT NULL CHECK (length(round_id) > 0),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  word TEXT NOT NULL CHECK (length(trim(word)) BETWEEN 2 AND 12),
  definition TEXT NOT NULL CHECK (length(trim(definition)) BETWEEN 8 AND 120),
  source TEXT NOT NULL CHECK (source IN ('gemini', 'workers-ai', 'local')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (room_id, effect_id)
);

CREATE UNIQUE INDEX idx_fib_word_generation_results_room_round
  ON fib_word_generation_results(room_id, round_id);
CREATE INDEX idx_fib_word_generation_results_created
  ON fib_word_generation_results(created_at);
