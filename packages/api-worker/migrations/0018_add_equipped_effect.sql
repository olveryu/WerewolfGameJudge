-- Add equipped_effect column for role reveal animation selection (cosmetic = users table)
ALTER TABLE users ADD COLUMN equipped_effect TEXT DEFAULT NULL;
