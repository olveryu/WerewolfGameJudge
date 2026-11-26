-- 聚会工具 account-owned identity presets (saved 身份方案).
--
-- name and normalized_name both hold the trimmed NFC name; duplicates are
-- judged on normalized_name only (case-sensitive). The unique index on
-- (owner_user_id, normalized_name) also serves the per-owner list, so no
-- separate owner index is created. Presets follow the account lifecycle:
-- account deletion cascades, and the WeChat account merge moves source
-- presets to the target in the same D1 batch that deletes the source.
CREATE TABLE toolbox_identity_presets (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) > 0),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) > 0),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) > 0),
  config_json TEXT NOT NULL CHECK (json_valid(config_json) AND json_type(config_json) = 'object'),
  version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_toolbox_identity_presets_owner_name
  ON toolbox_identity_presets(owner_user_id, normalized_name);
