CREATE TABLE fib_word_candidates (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  core_meaning TEXT NOT NULL,
  usage_note TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('literary', 'internet', 'compound', 'niche')),
  source TEXT NOT NULL CHECK (source IN ('gemini', 'local')),
  evidence_json TEXT NOT NULL CHECK (
    json_valid(evidence_json) AND json_type(evidence_json) = 'array'
    AND json_array_length(evidence_json) <= 2
  ),
  generation_cycle_id TEXT NOT NULL REFERENCES fib_word_generation_cycles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'claimed')),
  claimed_pack_id TEXT REFERENCES fib_word_packs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  CHECK (
    (status = 'pending' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'claimed' AND claimed_pack_id IS NOT NULL AND claimed_at IS NOT NULL)
  )
);
CREATE INDEX idx_fib_word_candidates_pending ON fib_word_candidates(status, created_at);
CREATE INDEX idx_fib_word_candidates_claim ON fib_word_candidates(claimed_pack_id);

ALTER TABLE fib_word_candidate_reviews ADD COLUMN evidence_json TEXT CHECK (
  evidence_json IS NULL OR (json_valid(evidence_json) AND json_type(evidence_json) = 'array')
);
ALTER TABLE fib_word_candidate_reviews ADD COLUMN evidence_index INTEGER CHECK (evidence_index >= 0);
ALTER TABLE fib_word_candidate_reviews ADD COLUMN evidence_quote TEXT CHECK (length(evidence_quote) BETWEEN 8 AND 300);
ALTER TABLE fib_word_packs ADD COLUMN outcome TEXT CHECK (outcome IN ('noCandidates', 'allRejected', 'reviewed'));