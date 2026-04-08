-- Track verification attempts per reset token to prevent brute-force
ALTER TABLE password_reset_tokens ADD COLUMN verify_attempts INTEGER NOT NULL DEFAULT 0;
