-- Drop the dead word-submission search index: GET /batches (its only reader)
-- is gone, and the FTS5 write path (ingestion search INSERT +
-- refreshSubmissionSearch) was removed with it, so no code reads or writes
-- word_submission_search anymore.
--
-- Safe to DROP directly: the FTS5 rows were keyed by batch rowid as an
-- implementation detail, with no foreign key in either direction, and no
-- table references a search row. DROP TABLE on an FTS5 virtual table also
-- removes its shadow tables.
DROP TABLE IF EXISTS word_submission_search;
