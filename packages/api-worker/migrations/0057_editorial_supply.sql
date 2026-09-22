CREATE TABLE editorial_model_requests (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  model TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);
CREATE INDEX idx_editorial_model_requests_time ON editorial_model_requests(claimed_at);

CREATE TABLE undercover_word_packs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  request_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'published', 'failed')),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  review_version TEXT NOT NULL,
  generation_json TEXT CHECK (generation_json IS NULL OR json_valid(generation_json)),
  candidates_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(candidates_json)),
  reviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reviews_json)),
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_undercover_word_packs_created ON undercover_word_packs(created_at);

CREATE TABLE undercover_word_candidates (
  id TEXT PRIMARY KEY,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL CHECK (word_a < word_b),
  category TEXT NOT NULL,
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  claimed_pack_id TEXT REFERENCES undercover_word_packs(id),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(word_a, word_b)
);
CREATE INDEX idx_undercover_word_candidates_pending ON undercover_word_candidates(status, category);