-- Candidate approval list (D2): the admin list pages keyset by
-- (created_at, id) within one status. Without an index on exactly that
-- order each page scans the whole pending queue (verified 2026-11-14: a
-- 500-row queue read 500 rows per page, growing with the queue).
--
-- One index per candidate table serves the list for every status filter.
-- The fib index also covers the claim's (status, created_at) prefix, so
-- the old (status, created_at) index is dropped rather than maintained
-- twice.
--
-- Write cost: one index entry per candidate insert or status change. The
-- candidate tables grow by a few rows per supply batch and the list is an
-- admin-only read, so the bounded-read saving dominates. One-time build
-- cost is a scan of three small tables.
DROP INDEX idx_fib_word_candidates_pending;
CREATE INDEX idx_fib_word_candidates_list ON fib_word_candidates(status, created_at, id);
CREATE INDEX idx_undercover_word_candidates_list
  ON undercover_word_candidates(status, created_at, id);
CREATE INDEX idx_drawguess_word_candidates_list
  ON drawguess_word_candidates(status, created_at, id);
