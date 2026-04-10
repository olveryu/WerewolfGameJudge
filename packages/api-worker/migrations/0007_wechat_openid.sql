-- Add WeChat OpenID column for mini program login
ALTER TABLE users ADD COLUMN wechat_openid TEXT;
CREATE UNIQUE INDEX idx_users_wechat_openid ON users(wechat_openid);
