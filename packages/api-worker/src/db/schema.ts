/**
 * Drizzle ORM schema — D1 表定义
 *
 * 与 migrations/ 下的 SQL 保持一致。修改字段时需同步新增 migration 文件。
 * 表名、列名使用 snake_case，与 D1 中的物理列一致。
 */

import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ── users ───────────────────────────────────────────────────────────────────

/** 用户表。 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** 可为 null：OAuth / 匿名用户无 email */
    email: text('email'),
    /** 可为 null：OAuth 用户无密码（WeChat-only / 匿名升级前） */
    passwordHash: text('password_hash'),
    displayName: text('display_name'),
    /** 默认头像 URL（注册时生成） */
    avatarUrl: text('avatar_url'),
    /** 用户上传的自定义头像（优先级高于 avatarUrl） */
    customAvatarUrl: text('custom_avatar_url'),
    /** 装备的头像框 gacha item ID */
    avatarFrame: text('avatar_frame'),
    /** 装备的座位特效 gacha item ID */
    equippedFlair: text('equipped_flair'),
    /** 装备的名字样式 gacha item ID */
    equippedNameStyle: text('equipped_name_style'),
    /** 装备的翻牌动画 gacha item ID */
    equippedEffect: text('equipped_effect'),
    /** 装备的入座动画 gacha item ID */
    equippedSeatAnimation: text('equipped_seat_animation'),
    /** 微信 OAuth 唯一标识符（一个 openid 只绑定一个账号） */
    wechatOpenid: text('wechat_openid'),
    /** SQLite boolean：0=认证用户，1=匿名用户 */
    isAnonymous: integer('is_anonymous').notNull().default(1),
    /** 每次登出/改密递增；使所有已颁发 access token 失效（JWT payload.ver 校验） */
    tokenVersion: integer('token_version').notNull().default(0),
    /** 最近连接的国家代码（如 'CN'/'US'），来自 CF request.cf */
    lastCountry: text('last_country'),
    /** 最近连接的 CF colo（如 'SJC'/'HKG'），来自 CF request.cf */
    lastColo: text('last_colo'),
    /** ISO 8601 UTC */
    createdAt: text('created_at').notNull(),
    /** ISO 8601 UTC */
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_users_wechat_openid').on(table.wechatOpenid)],
);

// ── rooms ───────────────────────────────────────────────────────────────────

/** 房间表。 */
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  hostUserId: text('host_user_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ── password_reset_tokens ───────────────────────────────────────────────────

/** 密码重置令牌表。 */
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 6 位验证码与 email 拼接后的 SHA-256 hash */
  tokenHash: text('token_hash').notNull(),
  /** ISO 8601 UTC；创建后 15 分钟过期 */
  expiresAt: text('expires_at').notNull(),
  /** SQLite boolean：0=未使用，1=已使用（成功重置后标记） */
  isUsed: integer('is_used').notNull().default(0),
  /** 验证尝试次数；达到 5 次后令牌失效 */
  verifyAttempts: integer('verify_attempts').notNull().default(0),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});

// ── refresh_tokens ──────────────────────────────────────────────────────────

/** Refresh token 表。单次使用（rotation）：消费时原子 DELETE-RETURNING。 */
export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 32-byte 随机 token 的 SHA-256 hex hash（明文不存储） */
    tokenHash: text('token_hash').notNull(),
    /** ISO 8601 UTC；90 天有效期 */
    expiresAt: text('expires_at').notNull(),
    /** ISO 8601 UTC */
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_refresh_tokens_user_id').on(table.userId),
    index('idx_refresh_tokens_token_hash').on(table.tokenHash),
  ],
);

// ── login_attempts ──────────────────────────────────────────────────────────

/** 登录尝试记录（限流用）。10 次/15 分钟后拦截，由 cron 每小时清理。 */
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  /** email 的 SHA-256 hash（不存储明文，防制举攻击时泄露 email） */
  emailHash: text('email_hash').notNull(),
  /** ISO 8601 UTC */
  attemptedAt: text('attempted_at').notNull(),
});

// ── user_stats ──────────────────────────────────────────────────────────────

/** 用户统计（XP / 等级 / 扭蛋）。 */
export const userStats = sqliteTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  lastRoomCode: text('last_room_code'),
  /** JSON 字符串化的已解锁 gacha reward ID 数组（如 '["flair_fire","frame_gold"]'） */
  unlockedItems: text('unlocked_items').notNull().default('[]'),
  /** 剩余普通抽次数 */
  normalDraws: integer('normal_draws').notNull().default(0),
  /** 剩余金色抽次数 */
  goldenDraws: integer('golden_draws').notNull().default(0),
  /** 普通抽保底计数（0-9）；第 10 抽(pityCount>=9)强制升级 rare+，触发后归零 */
  normalPity: integer('normal_pity').notNull().default(0),
  /** 金色抽保底计数（0-9）；同上 */
  goldenPity: integer('golden_pity').notNull().default(0),
  /** 碎片余额（重复物品转换获得，用于兑换） */
  shards: integer('shards').notNull().default(0),
  /** OCC 版本号；每次写操作 WHERE version = ? 保证原子性，冲突时重试 */
  version: integer('version').notNull().default(0),
  /** ISO 8601 UTC；最近一次每日奖励领取时间（冷却 20h）。null = 从未领取 */
  lastLoginRewardAt: text('last_login_reward_at'),
  /** ISO 8601 UTC；最近一次 XP 结算时间戳。null = 从未结算 */
  settledAt: text('settled_at'),
  /** ISO 8601 UTC */
  updatedAt: text('updated_at').notNull(),
});

// ── draw_history ────────────────────────────────────────────────────────────

/** 扭蛋抽取历史。 */
export const drawHistory = sqliteTable('draw_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'normal' | 'golden' */
  drawType: text('draw_type').notNull(),
  /** 抽中的稀有度（'common' | 'rare' | 'epic' | 'legendary'） */
  rarity: text('rarity').notNull(),
  /** 奖励类型（'flair' | 'frame' | 'nameStyle' | 'effect' | 'seatAnimation'） */
  rewardType: text('reward_type').notNull(),
  /** 奖励物品 ID */
  rewardId: text('reward_id').notNull(),
  /** 本次抽取时的 pity 计数值（0-9） */
  pityCount: integer('pity_count').notNull(),
  /** SQLite boolean：是否由保底触发 */
  isPityTriggered: integer('is_pity_triggered').notNull().default(0),
  /** SQLite boolean：是否为重复物品（转碎片） */
  isDuplicate: integer('is_duplicate').notNull().default(0),
  /** 重复时补償的碎片数；非重复时为 0 */
  shardsAwarded: integer('shards_awarded').notNull().default(0),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});

// ── room_participants ────────────────────────────────────────────────────────

/** 房间参与者关联表。 */
export const roomParticipants = sqliteTable(
  'room_participants',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: text('joined_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomCode, table.userId] }),
    index('idx_room_participants_room_code').on(table.roomCode),
    index('idx_room_participants_user_id').on(table.userId),
  ],
);

// ── idempotency_keys ────────────────────────────────────────────────────────

/** 幂等键表（防重放）。TTL 24h，由 cron 清理。 */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    /** 幂等键（客户端生成的 UUID） */
    key: text('key').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 缓存的响应 JSON（重放时直接返回） */
    response: text('response').notNull(),
    /** ISO 8601 UTC */
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_idempotency_keys_created_at').on(table.createdAt)],
);

// ── feedbacks ───────────────────────────────────────────────────────────────

/** 用户反馈表。 */
export const feedbacks = sqliteTable(
  'feedbacks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    githubIssueNumber: integer('github_issue_number').notNull(),
    content: text('content').notNull(),
    appVersion: text('app_version').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_feedbacks_user_id').on(table.userId),
    uniqueIndex('idx_feedbacks_github_issue_number').on(table.githubIssueNumber),
  ],
);

// ── feedback_replies ────────────────────────────────────────────────────────

/** 反馈回复表。 */
export const feedbackReplies = sqliteTable(
  'feedback_replies',
  {
    id: text('id').primaryKey(),
    feedbackId: text('feedback_id')
      .notNull()
      .references(() => feedbacks.id, { onDelete: 'cascade' }),
    isAdmin: integer('is_admin').notNull().default(0),
    body: text('body').notNull(),
    githubCommentId: integer('github_comment_id'),
    isRead: integer('is_read').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_feedback_replies_feedback_id').on(table.feedbackId),
    unique('idx_feedback_replies_github_comment_id').on(table.githubCommentId),
  ],
);

// ── wx_claims ───────────────────────────────────────────────────────────────

/** 微信 claim nonce 表。TTL 5 分钟，由 cron 清理。 */
export const wxClaims = sqliteTable('wx_claims', {
  /** 一次性 nonce（小程序端生成，消费后删除） */
  nonce: text('nonce').primaryKey(),
  /** 微信用户 openid（login code 换取后存入） */
  openid: text('openid').notNull(),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});
