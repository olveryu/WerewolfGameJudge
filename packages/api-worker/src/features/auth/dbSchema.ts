/** Authentication-owned D1 table definitions. */

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    uniqueIndex('idx_refresh_tokens_token_hash').on(table.tokenHash),
  ],
);

/** Consumed-token lineage retained for retry recovery and family reuse detection. */
export const refreshTokenRotations = sqliteTable(
  'refresh_token_rotations',
  {
    /** SHA-256 hash of the consumed refresh token. */
    tokenHash: text('token_hash').primaryKey(),
    /** Stable family row whose current token advances on every rotation. */
    refreshTokenId: text('refresh_token_id')
      .notNull()
      .references(() => refreshTokens.id, { onDelete: 'cascade' }),
    /** SHA-256 hash of the deterministic successor returned for replay recovery. */
    successorTokenHash: text('successor_token_hash').notNull(),
    /** Canonical ISO timestamp when this predecessor was consumed. */
    rotatedAt: text('rotated_at').notNull(),
  },
  (table) => [index('idx_refresh_token_rotations_refresh_token_id').on(table.refreshTokenId)],
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
