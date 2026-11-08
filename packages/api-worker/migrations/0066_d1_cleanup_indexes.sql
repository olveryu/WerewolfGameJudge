-- Add the two missing indexes behind the daily 03:00 cleanup so it stops
-- full-scanning users and refresh_tokens once a day:
-- - cleanupAnonymousUsers (features/account/maintenance.ts) filters users
--   on (is_anonymous, updated_at);
-- - cleanupExpiredRefreshTokenFamilies (features/auth/maintenance.ts)
--   filters refresh_tokens on expires_at.
-- No third index for fib_word_sequence(word): that column is UNIQUE
-- (0051_fib_word_progress.sql), so SQLite already keeps an autoindex on it
-- and the EXISTS in cleanupFibWordAudit already seeks instead of scanning.
CREATE INDEX idx_users_anonymous_updated ON users(is_anonymous, updated_at);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
