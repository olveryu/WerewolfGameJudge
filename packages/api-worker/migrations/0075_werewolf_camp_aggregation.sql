-- Keep settlement receipts intact; aggregate only records already visible after two hours.
ALTER TABLE camp_settlements ADD COLUMN is_aggregated INTEGER NOT NULL DEFAULT 0
  CONSTRAINT camp_settlements_valid_row CHECK (
    is_aggregated IN (0, 1)
    AND camp IN ('wolf', 'god', 'villager', 'third')
    AND datetime(settled_at) IS NOT NULL
  );

CREATE TABLE werewolf_user_camp_stats (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wolf_count INTEGER NOT NULL DEFAULT 0 CHECK (wolf_count >= 0),
  god_count INTEGER NOT NULL DEFAULT 0 CHECK (god_count >= 0),
  villager_count INTEGER NOT NULL DEFAULT 0 CHECK (villager_count >= 0),
  third_count INTEGER NOT NULL DEFAULT 0 CHECK (third_count >= 0)
);

CREATE INDEX idx_camp_pending_user
  ON camp_settlements(user_id, datetime(settled_at), camp)
  WHERE is_aggregated = 0;
CREATE INDEX idx_camp_pending_due
  ON camp_settlements(datetime(settled_at), user_id, settle_key)
  WHERE is_aggregated = 0;
DROP INDEX idx_camp_settlements_user_settled;
