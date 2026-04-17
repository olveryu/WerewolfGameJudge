-- Add equipped_name_style column for name text effect selection (cosmetic = users table)
ALTER TABLE users ADD COLUMN equipped_name_style TEXT DEFAULT NULL;
