-- Replace per-round online generation with a reusable FibKing word pool.

DROP TABLE fib_word_generation_results;

CREATE TABLE fib_words (
  id                  TEXT PRIMARY KEY,
  word                TEXT NOT NULL UNIQUE,
  core_meaning        TEXT NOT NULL,
  usage_note          TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('literary', 'internet', 'compound', 'niche')),
  source              TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  status              TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  selection_key       INTEGER NOT NULL CHECK (selection_key >= 0),
  generation_cycle_id TEXT,
  created_at          TEXT NOT NULL,
  activated_at        TEXT NOT NULL,
  disabled_at         TEXT,
  status_reason       TEXT,
  CHECK (
    (status = 'active' AND disabled_at IS NULL AND status_reason IS NULL) OR
    (status = 'disabled' AND disabled_at IS NOT NULL AND status_reason IS NOT NULL)
  )
);

CREATE INDEX idx_fib_words_selection
  ON fib_words(status, category, selection_key, id);

CREATE TABLE fib_word_supply_state (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  active_cycle_id          TEXT,
  active_cycle_started_at  TEXT,
  lease_owner              TEXT,
  lease_expires_at         TEXT,
  last_completed_at        TEXT,
  updated_at               TEXT NOT NULL,
  CHECK ((active_cycle_id IS NULL) = (active_cycle_started_at IS NULL)),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);

INSERT INTO fib_word_supply_state (id, updated_at)
VALUES (1, '1970-01-01T00:00:00.000Z');

CREATE TABLE fib_word_generation_cycles (
  id                TEXT PRIMARY KEY,
  status            TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  provider          TEXT NOT NULL CHECK (provider = 'gemini'),
  model             TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  request_count     INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  accepted_count    INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  duplicate_count   INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  started_at        TEXT NOT NULL,
  completed_at      TEXT,
  error_code        TEXT,
  CHECK (
    (status = 'running' AND completed_at IS NULL AND error_code IS NULL) OR
    (status = 'completed' AND completed_at IS NOT NULL AND error_code IS NULL) OR
    (status = 'failed' AND completed_at IS NOT NULL AND error_code IS NOT NULL)
  )
);

CREATE INDEX idx_fib_word_generation_cycles_status_started
  ON fib_word_generation_cycles(status, started_at);

CREATE TABLE fib_round_word_selections (
  room_id             TEXT NOT NULL,
  room_creation_id    TEXT NOT NULL,
  effect_id           TEXT NOT NULL,
  round_id            TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  word_id             TEXT,
  word                 TEXT NOT NULL,
  core_meaning         TEXT NOT NULL,
  usage_note           TEXT NOT NULL,
  source               TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  selection_tier       TEXT NOT NULL CHECK (
    selection_tier IN (
      'category_unseen',
      'any_unseen',
      'category_recent',
      'any_active',
      'local_fallback'
    )
  ),
  selected_at          TEXT NOT NULL,
  PRIMARY KEY (room_id, effect_id),
  UNIQUE (room_id, round_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES fib_words(id) ON DELETE RESTRICT
);

CREATE INDEX idx_fib_round_word_selections_word
  ON fib_round_word_selections(word_id, selected_at);

CREATE TABLE fib_word_usages (
  room_creation_id TEXT NOT NULL,
  round_id         TEXT NOT NULL,
  word_id          TEXT,
  word             TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('local', 'gemini')),
  used_at          TEXT NOT NULL,
  participant_count INTEGER NOT NULL CHECK (participant_count > 0),
  PRIMARY KEY (room_creation_id, round_id),
  FOREIGN KEY (word_id) REFERENCES fib_words(id) ON DELETE RESTRICT
);

CREATE INDEX idx_fib_word_usages_word_used
  ON fib_word_usages(word_id, used_at);
