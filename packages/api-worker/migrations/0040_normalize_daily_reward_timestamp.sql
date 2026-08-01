-- Normalize the daily reward claim timestamp and enforce its canonical UTC format.

UPDATE user_stats
SET last_login_reward_at = last_login_reward_at || 'T00:00:00.000Z'
WHERE
  last_login_reward_at IS NOT NULL
  AND length(last_login_reward_at) = 10
  AND strftime('%Y-%m-%d', last_login_reward_at) IS last_login_reward_at;

-- Abort the migration rather than guessing how to repair any remaining malformed value.
CREATE TABLE _daily_reward_timestamp_migration_guard (
  value TEXT NOT NULL
    CONSTRAINT canonical_daily_reward_timestamp CHECK (
      length(value) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', value) IS value
    )
);

INSERT INTO _daily_reward_timestamp_migration_guard (value)
SELECT last_login_reward_at
FROM user_stats
WHERE last_login_reward_at IS NOT NULL;

DROP TABLE _daily_reward_timestamp_migration_guard;

CREATE TRIGGER user_stats_last_login_reward_at_insert
BEFORE INSERT ON user_stats
WHEN
  NEW.last_login_reward_at IS NOT NULL
  AND (
    length(NEW.last_login_reward_at) != 24
    OR strftime('%Y-%m-%dT%H:%M:%fZ', NEW.last_login_reward_at)
      IS NOT NEW.last_login_reward_at
  )
BEGIN
  SELECT RAISE(ABORT, 'last_login_reward_at must be a canonical ISO timestamp');
END;

CREATE TRIGGER user_stats_last_login_reward_at_update
BEFORE UPDATE OF last_login_reward_at ON user_stats
WHEN
  NEW.last_login_reward_at IS NOT NULL
  AND (
    length(NEW.last_login_reward_at) != 24
    OR strftime('%Y-%m-%dT%H:%M:%fZ', NEW.last_login_reward_at)
      IS NOT NEW.last_login_reward_at
  )
BEGIN
  SELECT RAISE(ABORT, 'last_login_reward_at must be a canonical ISO timestamp');
END;
