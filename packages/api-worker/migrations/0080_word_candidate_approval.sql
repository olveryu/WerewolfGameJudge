-- Candidate approval gate (D2): candidates gain an 'approved' state; only
-- approved candidates are claimed for review. Approvals are audited per
-- candidate in word_candidate_approvals.
--
-- No fib_word_packs rebuild here: the packs table is referenced by
-- candidates, provider requests and the word sequence, and D1 applies each
-- migration inside a transaction, where PRAGMA foreign_keys = OFF is a
-- no-op — dropping the packs table fails while referencing rows exist
-- (verified 2026-11-14 against local D1). A gated pack therefore stays
-- 'reserved' with a NULL outcome; the gate is recorded by the workflow run
-- returning { status: 'awaitingApproval' } and by the pending candidates
-- waiting in the candidate tables.

-- Rebuild fib_word_candidates with 'approved' in the status CHECK and in the
-- table-level CHECK (an approved candidate holds no claim).
CREATE TABLE fib_word_candidates_next (
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'claimed')),
  claimed_pack_id TEXT REFERENCES fib_word_packs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  topic TEXT,
  CHECK (
    (status = 'pending' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'approved' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'claimed' AND claimed_pack_id IS NOT NULL AND claimed_at IS NOT NULL)
  )
);
INSERT INTO fib_word_candidates_next SELECT * FROM fib_word_candidates;
DROP TABLE fib_word_candidates;
ALTER TABLE fib_word_candidates_next RENAME TO fib_word_candidates;
CREATE INDEX idx_fib_word_candidates_pending ON fib_word_candidates(status, created_at);
CREATE INDEX idx_fib_word_candidates_claim ON fib_word_candidates(claimed_pack_id);

-- Rebuild undercover_word_candidates with 'approved' in the status CHECK.
CREATE TABLE undercover_word_candidates_next (
  id TEXT PRIMARY KEY,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL CHECK (word_a < word_b),
  category TEXT NOT NULL,
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'accepted', 'rejected')),
  claimed_pack_id TEXT REFERENCES undercover_word_packs(id),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(word_a, word_b)
);
INSERT INTO undercover_word_candidates_next SELECT * FROM undercover_word_candidates;
DROP TABLE undercover_word_candidates;
ALTER TABLE undercover_word_candidates_next RENAME TO undercover_word_candidates;
CREATE INDEX idx_undercover_word_candidates_pending ON undercover_word_candidates(status, category);

-- Rebuild drawguess_word_candidates with 'approved' in the status CHECK.
CREATE TABLE drawguess_word_candidates_next (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  review_json TEXT CHECK (review_json IS NULL OR json_valid(review_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'accepted', 'rejected')),
  claimed_pack_id TEXT REFERENCES drawguess_word_packs(id),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(word)
);
INSERT INTO drawguess_word_candidates_next SELECT * FROM drawguess_word_candidates;
DROP TABLE drawguess_word_candidates;
ALTER TABLE drawguess_word_candidates_next RENAME TO drawguess_word_candidates;
CREATE INDEX idx_drawguess_word_candidates_pending ON drawguess_word_candidates(status, category);

-- Candidate approval audit: one row per approved candidate, grouped by the
-- approve request that approved them. Candidates and external submissions
-- are separate tables, so each keeps its own audit.
CREATE TABLE word_candidate_approvals (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('fibking', 'undercover', 'drawguess')),
  candidate_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_word_candidate_approvals_request
  ON word_candidate_approvals(request_id, created_at);
