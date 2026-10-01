-- Admin portal access control: per-user admin flag (default: not admin).
-- Purely additive; existing rows default to 0. The first (super) admin is
-- bootstrapped via the ADMIN_USER_IDS env var; further admins are granted
-- through the admin portal, which flips this column.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
