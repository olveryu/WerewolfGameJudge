-- Drop the dead candidate pipeline tables: supply writes submissions now
-- (word_submission_items), and the candidate review/publish flow is gone.
-- Rows go with the tables; published inventory (fib_words /
-- undercover_word_pairs / drawguess_words) and the pack tables are untouched.
--
-- Safe to DROP directly: the candidate tables' foreign keys are outbound
-- (to packs / generation_cycles), and no table references a candidate row
-- (0083 comment), so no parent/child rebuild is needed. Their indexes go
-- with the tables. The three pinned tables (fib_word_candidates,
-- fib_word_candidate_reviews, undercover_word_candidates) are also removed
-- from their dbSchema.ts owner modules and from the contract-test table
-- list in the same change; the other three were raw-SQL-only.
DROP TABLE IF EXISTS fib_word_candidates;
DROP TABLE IF EXISTS undercover_word_candidates;
DROP TABLE IF EXISTS drawguess_word_candidates;
DROP TABLE IF EXISTS fib_word_candidate_reviews;
DROP TABLE IF EXISTS word_candidate_approvals;
DROP TABLE IF EXISTS word_candidate_dismissals;
