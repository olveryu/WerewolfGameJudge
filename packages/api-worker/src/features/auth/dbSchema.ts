/** Authentication-owned D1 table definitions. */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from '../account/dbSchema';

/** Single-use password reset challenges. */
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  isUsed: integer('is_used').notNull().default(0),
  verifyAttempts: integer('verify_attempts').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

/** Single-use refresh tokens consumed through rotation. */
export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_user_id').on(table.userId),
    index('idx_refresh_tokens_token_hash').on(table.tokenHash),
  ],
);

/** Login attempts used by authentication rate limiting. */
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  emailHash: text('email_hash').notNull(),
  attemptedAt: text('attempted_at').notNull(),
});

/** Single-use WeChat login claims. */
export const wxClaims = sqliteTable('wx_claims', {
  nonce: text('nonce').primaryKey(),
  openid: text('openid').notNull(),
  createdAt: text('created_at').notNull(),
});
