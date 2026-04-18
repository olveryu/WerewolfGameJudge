-- Track last-seen Cloudflare edge location for diagnostics (GFW / latency analysis)
ALTER TABLE users ADD COLUMN last_country TEXT;
ALTER TABLE users ADD COLUMN last_colo TEXT;
