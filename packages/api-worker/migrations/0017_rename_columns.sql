-- Rename columns for naming consistency:
-- rooms.host_id → host_user_id  (clarify it's a user FK)
-- password_reset_tokens.used → is_used  (boolean naming convention)
-- draw_history.pity_triggered → is_pity_triggered  (boolean naming convention)

ALTER TABLE rooms RENAME COLUMN host_id TO host_user_id;
ALTER TABLE password_reset_tokens RENAME COLUMN used TO is_used;
ALTER TABLE draw_history RENAME COLUMN pity_triggered TO is_pity_triggered;
