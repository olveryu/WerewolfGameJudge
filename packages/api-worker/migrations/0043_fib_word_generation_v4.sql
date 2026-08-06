-- Replace pre-v4 Fib results; old room state is intentionally unsupported.

DROP TABLE fib_word_generation_results;

CREATE TABLE fib_word_generation_results (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_creation_id TEXT NOT NULL CHECK (length(room_creation_id) > 0),
  effect_id TEXT NOT NULL CHECK (length(effect_id) > 0),
  round_id TEXT NOT NULL CHECK (length(round_id) > 0),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  requested_at INTEGER NOT NULL CHECK (requested_at >= 0),
  deadline_at INTEGER NOT NULL CHECK (deadline_at >= requested_at),
  word TEXT NOT NULL CHECK (length(trim(word)) BETWEEN 2 AND 12),
  core_meaning TEXT NOT NULL CHECK (length(trim(core_meaning)) BETWEEN 12 AND 100),
  usage_note TEXT NOT NULL CHECK (length(trim(usage_note)) BETWEEN 12 AND 100),
  source TEXT NOT NULL CHECK (source IN ('gemini', 'workers-ai', 'local')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (room_id, effect_id)
);

CREATE UNIQUE INDEX idx_fib_word_generation_results_room_round
  ON fib_word_generation_results(room_id, round_id);
CREATE INDEX idx_fib_word_generation_results_created
  ON fib_word_generation_results(created_at);