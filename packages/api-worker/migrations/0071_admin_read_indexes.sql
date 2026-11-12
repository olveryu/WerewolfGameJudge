CREATE INDEX idx_fib_words_generation_cycle ON fib_words(generation_cycle_id);
CREATE INDEX idx_users_created ON users(created_at, id);
CREATE INDEX idx_users_updated ON users(updated_at, id);
CREATE INDEX idx_user_stats_level ON user_stats(level, user_id);
CREATE INDEX idx_user_stats_games_played ON user_stats(games_played, user_id);
PRAGMA optimize;
