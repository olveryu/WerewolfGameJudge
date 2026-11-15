-- Candidate manual review and publish (one unified road): candidates gain
-- 'reviewing' (a manual model review is in flight), 'passed' (review
-- accepted, awaiting manual publish), 'rejected' (review rejected),
-- 'failed' (review errored, retryable), and 'published' (inventory written
-- by the manual publish endpoint). Undercover candidates also gain
-- review_json, the stored accepted review, in the same shape as drawguess.
-- The supply workflow no longer claims, reviews, or publishes candidates:
-- approved candidates wait for the manual review/publish endpoints, and
-- fibking inventory is no longer re-reviewed, so the old 'claimed' state
-- stays in the CHECK for legacy rows but no new claim is written.
--
-- Table-copy pattern (0080): D1 applies each migration inside a
-- transaction, where PRAGMA foreign_keys = OFF is a no-op, so the candidate
-- tables (children of the packs and generation-cycle tables) are rebuilt
-- the same way 0080 rebuilt them. Indexes are recreated unchanged.

-- Rebuild fib_word_candidates with the manual review/publish states in the
-- status CHECK and in the table-level CHECK (a candidate in any of the new
-- states holds no claim, like pending/approved).
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'claimed', 'reviewing', 'passed', 'rejected', 'failed', 'published')),
  claimed_pack_id TEXT REFERENCES fib_word_packs(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  topic TEXT,
  CHECK (
    (status = 'pending' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'approved' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'claimed' AND claimed_pack_id IS NOT NULL AND claimed_at IS NOT NULL)
    OR (status = 'reviewing' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'passed' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'rejected' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'failed' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
    OR (status = 'published' AND claimed_pack_id IS NULL AND claimed_at IS NULL)
  )
);
INSERT INTO fib_word_candidates_next SELECT * FROM fib_word_candidates;
DROP TABLE fib_word_candidates;
ALTER TABLE fib_word_candidates_next RENAME TO fib_word_candidates;
CREATE INDEX idx_fib_word_candidates_pending ON fib_word_candidates(status, created_at);
CREATE INDEX idx_fib_word_candidates_claim ON fib_word_candidates(claimed_pack_id);

-- Rebuild undercover_word_candidates with the manual review/publish states
-- and a review_json column holding the stored accepted review (same shape
-- as drawguess: the parsed review object, or NULL before review).
CREATE TABLE undercover_word_candidates_next (
  id TEXT PRIMARY KEY,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL CHECK (word_a < word_b),
  category TEXT NOT NULL,
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  review_json TEXT CHECK (review_json IS NULL OR json_valid(review_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'accepted', 'rejected', 'reviewing', 'passed', 'failed', 'published')),
  claimed_pack_id TEXT REFERENCES undercover_word_packs(id),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(word_a, word_b)
);
INSERT INTO undercover_word_candidates_next
  (id, word_a, word_b, category, material_json, review_json, status, claimed_pack_id, created_at, reviewed_at)
  SELECT id, word_a, word_b, category, material_json, NULL, status, claimed_pack_id, created_at, reviewed_at
  FROM undercover_word_candidates;
DROP TABLE undercover_word_candidates;
ALTER TABLE undercover_word_candidates_next RENAME TO undercover_word_candidates;
CREATE INDEX idx_undercover_word_candidates_pending ON undercover_word_candidates(status, category);

-- Rebuild drawguess_word_candidates with the manual review/publish states.
-- review_json already exists here; the stored accepted review is reused.
CREATE TABLE drawguess_word_candidates_next (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  material_json TEXT NOT NULL CHECK (json_valid(material_json)),
  review_json TEXT CHECK (review_json IS NULL OR json_valid(review_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'accepted', 'rejected', 'reviewing', 'passed', 'failed', 'published')),
  claimed_pack_id TEXT REFERENCES drawguess_word_packs(id),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE(word)
);
INSERT INTO drawguess_word_candidates_next SELECT * FROM drawguess_word_candidates;
DROP TABLE drawguess_word_candidates;
ALTER TABLE drawguess_word_candidates_next RENAME TO drawguess_word_candidates;
CREATE INDEX idx_drawguess_word_candidates_pending ON drawguess_word_candidates(status, category);
