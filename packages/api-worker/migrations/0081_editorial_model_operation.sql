-- Editorial budget split (D6): record whether each model call was generation
-- or review, so the dashboard can show the two separately.
--
-- Historical rows are backfilled from the claim id, which is the only
-- operation signal the ledger ever carried: ids ending in ':review' and
-- 'submission:*' (external review) are reviews; everything else
-- (generation and the fib history classification that precedes it) is
-- generation. New rows always carry the operation from
-- claimEditorialModelRequest, the ledger's only writer.
ALTER TABLE editorial_model_requests ADD COLUMN operation TEXT NOT NULL DEFAULT 'generation'
  CHECK (operation IN ('generation', 'review'));
UPDATE editorial_model_requests SET operation = CASE
  WHEN id LIKE 'submission:%' THEN 'review'
  WHEN id LIKE '%:review' THEN 'review'
  ELSE 'generation' END;
