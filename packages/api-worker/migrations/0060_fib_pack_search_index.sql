-- Persist the search query index on each fib pack so the admin word-supply
-- dashboard can attribute published words back to the originating query.
ALTER TABLE fib_word_packs ADD COLUMN search_index INTEGER;

-- Backfill: within each month, packs were reserved in creation order and
-- searchIndex was assigned as (requests_reserved - 1), i.e. the Nth reserved
-- pack of the month used search index N-1.
UPDATE fib_word_packs
SET search_index = ranked.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY month_id ORDER BY created_at, id) AS rn
  FROM fib_word_packs
) AS ranked
WHERE fib_word_packs.id = ranked.id;
