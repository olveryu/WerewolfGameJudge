-- 0027: Add status column to feedbacks table for open/resolved tracking.
-- Synced with GitHub Issue state via webhook.

ALTER TABLE feedbacks ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
