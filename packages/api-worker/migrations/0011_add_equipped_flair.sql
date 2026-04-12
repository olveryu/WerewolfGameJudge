-- Add equipped_flair column for seat decoration selection (cosmetic = users table)
ALTER TABLE users ADD COLUMN equipped_flair TEXT DEFAULT NULL;
