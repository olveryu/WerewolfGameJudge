/**
 * Drizzle ORM schema — D1 表定义
 *
 * 与 migrations/ 下的 SQL 保持一致。修改字段时需同步新增 migration 文件。
 * 表名、列名使用 snake_case，与 D1 中的物理列一致。
 */

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email'),
    passwordHash: text('password_hash'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    customAvatarUrl: text('custom_avatar_url'),
    avatarFrame: text('avatar_frame'),
    equippedFlair: text('equipped_flair'),
    equippedNameStyle: text('equipped_name_style'),
    equippedEffect: text('equipped_effect'),
    equippedSeatAnimation: text('equipped_seat_animation'),
    wechatOpenid: text('wechat_openid'),
    isAnonymous: integer('is_anonymous').notNull().default(1),
    tokenVersion: integer('token_version').notNull().default(0),
    lastCountry: text('last_country'),
    lastColo: text('last_colo'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_users_wechat_openid').on(table.wechatOpenid)],
);

// ── rooms ───────────────────────────────────────────────────────────────────

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  hostUserId: text('host_user_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── password_reset_tokens ───────────────────────────────────────────────────

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

// ── refresh_tokens ──────────────────────────────────────────────────────────

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

// ── login_attempts ──────────────────────────────────────────────────────────

export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  emailHash: text('email_hash').notNull(),
  attemptedAt: text('attempted_at').notNull(),
});

// ── user_stats ──────────────────────────────────────────────────────────────

export const userStats = sqliteTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  lastRoomCode: text('last_room_code'),
  unlockedItems: text('unlocked_items').notNull().default('[]'),
  normalDraws: integer('normal_draws').notNull().default(0),
  goldenDraws: integer('golden_draws').notNull().default(0),
  normalPity: integer('normal_pity').notNull().default(0),
  goldenPity: integer('golden_pity').notNull().default(0),
  version: integer('version').notNull().default(0),
  lastLoginRewardAt: text('last_login_reward_at'),
  updatedAt: text('updated_at').notNull(),
});

// ── draw_history ────────────────────────────────────────────────────────────

export const drawHistory = sqliteTable('draw_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  drawType: text('draw_type').notNull(),
  rarity: text('rarity').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardId: text('reward_id').notNull(),
  pityCount: integer('pity_count').notNull(),
  isPityTriggered: integer('is_pity_triggered').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
