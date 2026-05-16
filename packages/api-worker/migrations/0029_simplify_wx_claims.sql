-- Simplify wx_claims: store only openid by nonce.
-- User creation / token issuance moves to claim-time (web-view decides login vs bind).
-- Existing claims expire in 2min so safe to drop+recreate on deploy.

DROP TABLE IF EXISTS wx_claims;

CREATE TABLE wx_claims (
  nonce TEXT PRIMARY KEY,
  openid TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
