/**
 * Drizzle ORM schema — D1 table definitions
 *
 * Stay consistent with SQL under migrations/. When modifying fields, add a corresponding migration file.
 * Table and column names use snake_case to match physical columns in D1.
 */

import { GAME_TYPES } from '@werewolf/game-engine/platform/protocol/gameTypes';
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

/** Users table. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    /** Nullable: OAuth / anonymous users have no email */
    email: text('email'),
    /** Nullable: OAuth users have no password (WeChat-only / before anonymous upgrade) */
    passwordHash: text('password_hash'),
    displayName: text('display_name'),
    /** Default avatar URL (generated at registration) */
    avatarUrl: text('avatar_url'),
    /** User-uploaded custom avatar (takes priority over avatarUrl) */
    customAvatarUrl: text('custom_avatar_url'),
    /** Equipped avatar frame gacha item ID */
    avatarFrame: text('avatar_frame'),
    /** Equipped seat flair gacha item ID */
    equippedFlair: text('equipped_flair'),
    /** Equipped name style gacha item ID */
    equippedNameStyle: text('equipped_name_style'),
    /** Equipped card-flip animation gacha item ID */
    equippedEffect: text('equipped_effect'),
    /** Equipped seat animation gacha item ID */
    equippedSeatAnimation: text('equipped_seat_animation'),
    /** WeChat OAuth unique identifier (one openid binds to one account only) */
    wechatOpenid: text('wechat_openid'),
    /** SQLite boolean: 0=authenticated user, 1=anonymous user */
    isAnonymous: integer('is_anonymous').notNull().default(1),
    /** Incremented on each logout / password change; invalidates all issued access tokens (verified via JWT payload.ver) */
    tokenVersion: integer('token_version').notNull().default(0),
    /** Most recent connection country code (e.g. 'CN'/'US'), from CF request.cf */
    lastCountry: text('last_country'),
    /** Most recent connection CF colo (e.g. 'SJC'/'HKG'), from CF request.cf */
    lastColo: text('last_colo'),
    /** ISO 8601 UTC */
    createdAt: text('created_at').notNull(),
    /** ISO 8601 UTC */
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_users_wechat_openid').on(table.wechatOpenid)],
);

// ── rooms ───────────────────────────────────────────────────────────────────

export const ROOM_DIRECTORY_STATUSES = ['creating', 'active', 'deleting', 'failed'] as const;
export type RoomDirectoryStatus = (typeof ROOM_DIRECTORY_STATUSES)[number];

export const ROOM_SAGA_OPERATIONS = ['create', 'delete'] as const;
export type RoomSagaOperation = (typeof ROOM_SAGA_OPERATIONS)[number];

/** Public room directory and cross-storage saga state. */
export const rooms = sqliteTable(
  'rooms',
  {
    /** Immutable Durable Object instance ID. */
    id: text('id').primaryKey(),
    /** Reusable four-digit public lookup key. */
    code: text('code').notNull().unique(),
    gameType: text('game_type', { enum: GAME_TYPES }).notNull(),
    hostUserId: text('host_user_id').notNull(),
    creationId: text('creation_id').notNull().unique(),
    /** Canonical parsed game config used to resume initialization. */
    configJson: text('config_json').notNull(),
    status: text('status', { enum: ROOM_DIRECTORY_STATUSES }).notNull(),
    failureOperation: text('failure_operation', { enum: ROOM_SAGA_OPERATIONS }),
    lastError: text('last_error'),
    reconciliationAttemptCount: integer('reconciliation_attempt_count').notNull().default(0),
    reconcileAfter: text('reconcile_after'),
    deleteRequestedBy: text('delete_requested_by'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    /** Times a game started (startNight succeeded) in this room. Survives DO restart. */
    gamesStarted: integer('games_started').notNull().default(0),
    /** ISO 8601 UTC of the most recent game start. null = never started. */
    lastStartedAt: text('last_started_at'),
  },
  (table) => [
    index('idx_rooms_status_reconcile').on(table.status, table.reconcileAfter),
    index('idx_rooms_host_user').on(table.hostUserId),
  ],
);

/** Idempotency ledger for committed setup-to-ongoing room transitions. */
export const roomGameStarts = sqliteTable(
  'room_game_starts',
  {
    effectId: text('effect_id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    startedRevision: integer('started_revision').notNull(),
    startedAt: text('started_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_room_game_starts_room_revision').on(table.roomId, table.startedRevision),
    index('idx_room_game_starts_room_started').on(table.roomId, table.startedAt),
  ],
);

// ── password_reset_tokens ───────────────────────────────────────────────────

/** Password reset tokens table. */
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** SHA-256 hash of the 6-digit code concatenated with email */
  tokenHash: text('token_hash').notNull(),
  /** ISO 8601 UTC; expires 15 minutes after creation */
  expiresAt: text('expires_at').notNull(),
  /** SQLite boolean: 0=unused, 1=used (marked after successful reset) */
  isUsed: integer('is_used').notNull().default(0),
  /** Verification attempt count; token invalidated after 5 attempts */
  verifyAttempts: integer('verify_attempts').notNull().default(0),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});

// ── refresh_tokens ──────────────────────────────────────────────────────────

/** Refresh token table. Single-use (rotation): atomic DELETE-RETURNING on consume. */
export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 hex hash of the 32-byte random token (plaintext not stored) */
    tokenHash: text('token_hash').notNull(),
    /** ISO 8601 UTC; 90-day validity */
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

/** Login attempt records (for rate limiting). Block after 10 attempts / 15 minutes; cleaned hourly by cron. */
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  /** SHA-256 hash of the email (plaintext not stored, prevents leaking email during enumeration attacks) */
  emailHash: text('email_hash').notNull(),
  /** ISO 8601 UTC */
  attemptedAt: text('attempted_at').notNull(),
});

// ── user_stats ──────────────────────────────────────────────────────────────

/** User stats (XP / level / gacha). */
export const userStats = sqliteTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(0),
  gamesPlayed: integer('games_played').notNull().default(0),
  lastRoomCode: text('last_room_code'),
  /** JSON-stringified array of unlocked gacha reward IDs (e.g. '["flair_fire","frame_gold"]') */
  unlockedItems: text('unlocked_items').notNull().default('[]'),
  /** Remaining normal draw count */
  normalDraws: integer('normal_draws').notNull().default(0),
  /** Remaining golden draw count */
  goldenDraws: integer('golden_draws').notNull().default(0),
  /** Normal-draw pity counter (0-9); the 10th draw (pityCount>=9) forces rare+, resets after trigger */
  normalPity: integer('normal_pity').notNull().default(0),
  /** Golden-draw pity counter (0-9); same as above */
  goldenPity: integer('golden_pity').notNull().default(0),
  /** Shard balance (gained from duplicate-item conversion, used for redemption) */
  shards: integer('shards').notNull().default(0),
  /** OCC version number; each write uses WHERE version = ? for atomicity, retries on conflict */
  version: integer('version').notNull().default(0),
  /** ISO 8601 UTC; timestamp of the most recent daily reward claim (20h cooldown). null = never claimed */
  lastLoginRewardAt: text('last_login_reward_at'),
  /** ISO 8601 UTC; timestamp of the most recent XP settlement. null = never settled */
  settledAt: text('settled_at'),
  /** ISO 8601 UTC */
  updatedAt: text('updated_at').notNull(),
});

// ── draw_history ────────────────────────────────────────────────────────────

/** Gacha draw history. */
export const drawHistory = sqliteTable('draw_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'normal' | 'golden' */
  drawType: text('draw_type').notNull(),
  /** Rarity drawn ('common' | 'rare' | 'epic' | 'legendary') */
  rarity: text('rarity').notNull(),
  /** Reward type ('flair' | 'frame' | 'nameStyle' | 'effect' | 'seatAnimation') */
  rewardType: text('reward_type').notNull(),
  /** Reward item ID */
  rewardId: text('reward_id').notNull(),
  /** Pity counter value at the time of this draw (0-9) */
  pityCount: integer('pity_count').notNull(),
  /** SQLite boolean: whether triggered by pity */
  isPityTriggered: integer('is_pity_triggered').notNull().default(0),
  /** SQLite boolean: whether the result is a duplicate (converted to shards) */
  isDuplicate: integer('is_duplicate').notNull().default(0),
  /** Shards awarded as compensation when duplicate; 0 when not a duplicate */
  shardsAwarded: integer('shards_awarded').notNull().default(0),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});

// ── camp_settlements ──────────────────────────────────────────────────────────

/**
 * Per-game camp history (one row per registered player per settled game).
 *
 * Camp probability is computed on read by aggregating these rows. Public reads only
 * count rows where settled_at <= datetime('now', '-2 hours') (anti-cheat delay); self
 * reads count all rows. Idempotent under settlement retries via PK (user_id, settle_key).
 */
export const campSettlements = sqliteTable(
  'camp_settlements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Game-ended effect ID; shared with game_settlement_results.effect_id. */
    settleKey: text('settle_key').notNull(),
    /** Camp bucket: 'wolf' | 'god' | 'villager' | 'third' (CampBucket) */
    camp: text('camp').notNull(),
    /** ISO 8601 UTC; the game's settlement timestamp (drives the 2h public delay) */
    settledAt: text('settled_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.settleKey] }),
    index('idx_camp_settlements_user_settled').on(table.userId, table.settledAt),
  ],
);

// ── game_settlement_results ─────────────────────────────────────────────────

/** Exact per-player rewards committed for an at-least-once game-ended effect. */
export const gameSettlementResults = sqliteTable(
  'game_settlement_results',
  {
    effectId: text('effect_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomCode: text('room_code').notNull(),
    participantFingerprint: text('participant_fingerprint').notNull(),
    camp: text('camp').notNull(),
    previousXp: integer('previous_xp').notNull(),
    xpEarned: integer('xp_earned').notNull(),
    newXp: integer('new_xp').notNull(),
    previousLevel: integer('previous_level').notNull(),
    newLevel: integer('new_level').notNull(),
    normalDrawsEarned: integer('normal_draws_earned').notNull(),
    goldenDrawsEarned: integer('golden_draws_earned').notNull(),
    statsApplied: integer('stats_applied').notNull().default(0),
    settledAt: text('settled_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.effectId, table.userId] }),
    index('idx_game_settlement_results_user_settled').on(table.userId, table.settledAt),
  ],
);

// ── user_event_inbox ───────────────────────────────────────────────────────

/** Pending user events, deleted only after an authenticated client acknowledgement. */
export const userEventInbox = sqliteTable(
  'user_event_inbox',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.eventId] }),
    index('idx_user_event_inbox_delivery').on(table.userId, table.createdAt, table.eventId),
  ],
);

// ── room_participants ────────────────────────────────────────────────────────

/** Room participants association table. */
export const roomParticipants = sqliteTable(
  'room_participants',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: text('joined_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index('idx_room_participants_user_id').on(table.userId),
  ],
);

// ── idempotency_keys ────────────────────────────────────────────────────────

/** Idempotency keys table (replay protection). TTL 24h, cleaned by cron. */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    /** Idempotency key (client-generated UUID) */
    key: text('key').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Cached response JSON (returned directly on replay) */
    response: text('response').notNull(),
    /** ISO 8601 UTC */
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_idempotency_keys_created_at').on(table.createdAt)],
);

// ── feedbacks ───────────────────────────────────────────────────────────────

/** User feedback table. */
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

/** Feedback replies table. */
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

/** WeChat claim nonce table. TTL 5 minutes, cleaned by cron. */
export const wxClaims = sqliteTable('wx_claims', {
  /** Single-use nonce (generated by mini-program client, deleted on consume) */
  nonce: text('nonce').primaryKey(),
  /** WeChat user openid (stored after login-code exchange) */
  openid: text('openid').notNull(),
  /** ISO 8601 UTC */
  createdAt: text('created_at').notNull(),
});
