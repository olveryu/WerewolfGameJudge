/** Account-owned D1 table definitions. */

import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Users table. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** Nullable: OAuth / anonymous users have no email. */
    email: text('email'),
    /** Nullable: OAuth users have no password. */
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

/** User progression and gacha balances. */
export const userStats = sqliteTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  lastRoomCode: text('last_room_code'),
  unlockedItems: text('unlocked_items').notNull().default('[]'),
  normalDraws: integer('normal_draws').notNull().default(0),
  goldenDraws: integer('golden_draws').notNull().default(0),
  normalPity: integer('normal_pity').notNull().default(0),
  goldenPity: integer('golden_pity').notNull().default(0),
  shards: integer('shards').notNull().default(0),
  version: integer('version').notNull().default(0),
  lastLoginRewardAt: text('last_login_reward_at'),
  settledAt: text('settled_at'),
  updatedAt: text('updated_at').notNull(),
});
