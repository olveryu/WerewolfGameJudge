CREATE INDEX idx_users_country_options ON users(last_country)
WHERE last_country GLOB '[A-Z][A-Z]';
PRAGMA optimize;
