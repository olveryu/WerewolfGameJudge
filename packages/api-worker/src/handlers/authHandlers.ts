/**
 * Auth Route Handlers — 自实现认证 API (Hono routes)
 *
 * 覆盖匿名登录、邮箱注册/登录、用户资料更新、session 恢复。
 * JWT 签发/验证，密码用 PBKDF2 哈希存储到 D1。
 */

import {
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
} from '@werewolf/game-engine/growth/frameUnlock';
import { getLevel } from '@werewolf/game-engine/growth/level';
import { getItemRarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { drawHistory, loginAttempts, passwordResetTokens, users, userStats } from '../db/schema';
import type { AppEnv, Env } from '../env';
import {
  bumpTokenVersion,
  extractBearerToken,
  issueTokenPair,
  requireAuth,
  revokeAllRefreshTokens,
  rotateRefreshToken,
  verifyToken,
} from '../lib/auth';
import { sendPasswordResetEmail } from '../lib/email';
import { createLogger } from '../lib/logger';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  wechatCodeSchema,
} from '../schemas/auth';
import { getWeChatAuthStub, jsonBody } from './shared';
import { selectUserProfile, toUserMetadata } from './userProfile';

const log = createLogger('auth');

export const authRoutes = new Hono<AppEnv>();

/** Extract Cloudflare edge geo from incoming request. */
function requestGeo(c: { req: { raw: Request } }) {
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  return {
    lastCountry: (cf?.country as string) ?? null,
    lastColo: (cf?.colo as string) ?? null,
  };
}

/** 注册欢迎奖励：普通券 5 + 黄金券 1 */
const WELCOME_NORMAL_DRAWS = 5;
const WELCOME_GOLDEN_DRAWS = 1;

/** 给新注册用户发放欢迎抽奖券（upsert，已有行则累加） */
async function grantWelcomeBonus(db: ReturnType<typeof createDb>, userId: string): Promise<void> {
  await db
    .insert(userStats)
    .values({
      userId,
      normalDraws: WELCOME_NORMAL_DRAWS,
      goldenDraws: WELCOME_GOLDEN_DRAWS,
      updatedAt: sql`datetime('now')`,
    })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        normalDraws: sql`${userStats.normalDraws} + ${WELCOME_NORMAL_DRAWS}`,
        goldenDraws: sql`${userStats.goldenDraws} + ${WELCOME_GOLDEN_DRAWS}`,
        updatedAt: sql`datetime('now')`,
      },
    });
}

/**
 * Merge user_stats from sourceId into targetId before account deletion.
 * - xp / games_played / draws: sum
 * - pity: max (preserve progress toward guaranteed)
 * - unlocked_items: union; duplicates compensated as draw tickets
 *   (legendary → 1 golden, others → 1 normal)
 * - version: max + 1
 * - draw_history: re-assign to target user
 */
async function mergeUserStats(
  db: ReturnType<typeof createDb>,
  sourceId: string,
  targetId: string,
): Promise<void> {
  const [sourceStats, targetStats] = await Promise.all([
    db.select().from(userStats).where(eq(userStats.userId, sourceId)).get(),
    db.select().from(userStats).where(eq(userStats.userId, targetId)).get(),
  ]);

  // No source stats → nothing to merge
  if (!sourceStats) return;

  const sourceItems: string[] = JSON.parse(sourceStats.unlockedItems) as string[];

  if (!targetStats) {
    // Target has no stats row — transfer source row entirely by upsert
    await db
      .insert(userStats)
      .values({
        userId: targetId,
        xp: sourceStats.xp,
        level: getLevel(sourceStats.xp),
        gamesPlayed: sourceStats.gamesPlayed,
        lastRoomCode: sourceStats.lastRoomCode,
        unlockedItems: sourceStats.unlockedItems,
        normalDraws: sourceStats.normalDraws,
        goldenDraws: sourceStats.goldenDraws,
        normalPity: sourceStats.normalPity,
        goldenPity: sourceStats.goldenPity,
        version: sourceStats.version + 1,
        lastLoginRewardAt: sourceStats.lastLoginRewardAt,
        updatedAt: sql`datetime('now')`,
      })
      .onConflictDoNothing();

    // Migrate draw history
    await db.update(drawHistory).set({ userId: targetId }).where(eq(drawHistory.userId, sourceId));

    // Delete source stats (before user row CASCADE)
    await db.delete(userStats).where(eq(userStats.userId, sourceId));
    return;
  }

  // Both have stats — merge
  const targetItems: string[] = JSON.parse(targetStats.unlockedItems) as string[];
  const targetSet = new Set(targetItems);

  // Compute duplicate compensation
  let normalCompensation = 0;
  let goldenCompensation = 0;
  for (const id of sourceItems) {
    if (targetSet.has(id)) {
      // Duplicate — compensate with draw ticket
      if (getItemRarity(id) === 'legendary') {
        goldenCompensation++;
      } else {
        normalCompensation++;
      }
    }
  }

  // Union of unlocked items
  const mergedSet = new Set([...targetItems, ...sourceItems]);
  const mergedItems = JSON.stringify([...mergedSet]);
  const mergedXp = sourceStats.xp + targetStats.xp;

  await db
    .update(userStats)
    .set({
      xp: mergedXp,
      level: getLevel(mergedXp),
      gamesPlayed: sourceStats.gamesPlayed + targetStats.gamesPlayed,
      normalDraws: targetStats.normalDraws + sourceStats.normalDraws + normalCompensation,
      goldenDraws: targetStats.goldenDraws + sourceStats.goldenDraws + goldenCompensation,
      normalPity: Math.max(sourceStats.normalPity, targetStats.normalPity),
      goldenPity: Math.max(sourceStats.goldenPity, targetStats.goldenPity),
      unlockedItems: mergedItems,
      version: Math.max(sourceStats.version, targetStats.version) + 1,
      lastRoomCode:
        (sourceStats.updatedAt ?? '') > (targetStats.updatedAt ?? '')
          ? sourceStats.lastRoomCode
          : targetStats.lastRoomCode,
      lastLoginRewardAt:
        (sourceStats.lastLoginRewardAt ?? '') > (targetStats.lastLoginRewardAt ?? '')
          ? sourceStats.lastLoginRewardAt
          : targetStats.lastLoginRewardAt,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(userStats.userId, targetId));

  // Migrate draw history
  await db.update(drawHistory).set({ userId: targetId }).where(eq(drawHistory.userId, sourceId));

  // Delete source stats (before user row CASCADE)
  await db.delete(userStats).where(eq(userStats.userId, sourceId));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/anonymous — 匿名登录
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/anonymous', async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = crypto.randomUUID();
  const geo = requestGeo(c);

  const now = sql`datetime('now')`;
  await db.insert(users).values({
    id: userId,
    isAnonymous: 1,
    ...geo,
    createdAt: now,
    updatedAt: now,
  });

  const tokens = await issueTokenPair(userId, env, { anon: true, ver: 0 });

  return c.json(
    {
      ...tokens,
      user: { id: userId, is_anonymous: true, email: null, user_metadata: toUserMetadata(null) },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signup — 邮箱注册（或匿名升级）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/signup', jsonBody(signUpSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const request = c.req.raw;
  const parsed = c.req.valid('json');

  const email = parsed.email.toLowerCase().trim();
  const displayName = parsed.displayName || email.split('@')[0];

  // Check if request is from authenticated user eligible for in-place upgrade:
  // - anonymous user (payload.anon)
  // - WeChat-only user (no email, no password in DB)
  const bearerToken = extractBearerToken(request);
  let existingUserId: string | null = null;
  if (bearerToken) {
    const payload = await verifyToken(bearerToken, env);
    if (payload) {
      if (payload.anon) {
        existingUserId = payload.sub;
      } else {
        // Check DB: WeChat-only user (no email, no password) also eligible
        const row = await db
          .select({ email: users.email, passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, payload.sub))
          .get();
        if (row && !row.email && !row.passwordHash) {
          existingUserId = payload.sub;
        }
      }
    }
  }

  const passwordHash = await hashPassword(parsed.password);

  if (existingUserId) {
    // In-place upgrade (anonymous or WeChat-only → email): preserve UID + existing profile
    // Check email not already taken by another user
    const existing = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      // ── Account merge: WeChat user binding to an existing email account ──
      // Verify the caller is a WeChat-only user (has openid, no email)
      const callerRow = await db
        .select({ wechatOpenid: users.wechatOpenid })
        .from(users)
        .where(eq(users.id, existingUserId))
        .get();

      if (!callerRow?.wechatOpenid || !existing.passwordHash) {
        // Anonymous user or target has no password — cannot merge, plain conflict
        return c.json({ success: false, reason: 'EMAIL_ALREADY_REGISTERED' }, 409);
      }

      // Password is required for merge verification
      const mergeResult = await verifyPassword(parsed.password, existing.passwordHash);
      if (!mergeResult.valid) {
        return c.json({ success: false, reason: 'INVALID_CREDENTIALS' }, 401);
      }

      // Migrate openid to the email account and delete the WeChat shell account.
      // Merge growth data first (before CASCADE deletes source user_stats).
      try {
        await mergeUserStats(db, existingUserId, existing.id);

        // Use batch() for atomicity: clear openid → transfer → delete, all-or-nothing.
        await db.batch([
          db.update(users).set({ wechatOpenid: null }).where(eq(users.id, existingUserId)),
          db
            .update(users)
            .set({ wechatOpenid: callerRow.wechatOpenid, updatedAt: sql`datetime('now')` })
            .where(eq(users.id, existing.id)),
          db.delete(users).where(eq(users.id, existingUserId)),
        ]);
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        log.error('account merge DB error', { userId: existingUserId, msg });
        return c.json({ success: false, reason: 'ACCOUNT_MERGE_FAILED' }, 500);
      }

      // Read back merged account profile
      const mergedProfile = await selectUserProfile(db, existing.id);

      const mergedUser = await db
        .select({ tokenVersion: users.tokenVersion })
        .from(users)
        .where(eq(users.id, existing.id))
        .get();
      const tokens = await issueTokenPair(existing.id, env, {
        email,
        ver: mergedUser!.tokenVersion,
      });

      return c.json(
        {
          ...tokens,
          user: {
            id: existing.id,
            email,
            is_anonymous: false,
            user_metadata: toUserMetadata(mergedProfile),
          },
        },
        200,
      );
    }

    // Only overwrite display_name if caller explicitly provided one
    const updateName = parsed.displayName ? displayName : null;

    await db
      .update(users)
      .set({
        email,
        passwordHash,
        displayName: sql`COALESCE(${updateName}, ${users.displayName}, ${displayName})`,
        isAnonymous: 0,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(users.id, existingUserId));

    // Welcome bonus for anonymous/WeChat → email upgrade
    await grantWelcomeBonus(db, existingUserId);

    // Read back full profile (user may have cosmetics from anonymous/WeChat era)
    const upgradedProfile = await selectUserProfile(db, existingUserId);
    const upgraded = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, existingUserId))
      .get();

    const tokens = await issueTokenPair(existingUserId, env, {
      email,
      ver: upgraded!.tokenVersion,
    });

    return c.json(
      {
        ...tokens,
        user: {
          id: existingUserId,
          email,
          is_anonymous: false,
          user_metadata: toUserMetadata(upgradedProfile),
        },
      },
      200,
    );
  }

  // New user registration
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existing) {
    return c.json({ success: false, reason: 'EMAIL_ALREADY_REGISTERED' }, 409);
  }

  const userId = crypto.randomUUID();
  const now = sql`datetime('now')`;

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    displayName,
    isAnonymous: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Welcome bonus for new registered user
  await grantWelcomeBonus(db, userId);

  const tokens = await issueTokenPair(userId, env, { email, ver: 0 });

  return c.json(
    {
      ...tokens,
      user: {
        id: userId,
        email,
        is_anonymous: false,
        user_metadata: toUserMetadata({
          displayName,
          avatarUrl: null,
          customAvatarUrl: null,
          avatarFrame: null,
          equippedFlair: null,
          equippedNameStyle: null,
          equippedEffect: null,
          equippedSeatAnimation: null,
        }),
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signin — 邮箱密码登录
// ─────────────────────────────────────────────────────────────────────────────

/** Max failed login attempts per email within the rate limit window */
const SIGN_IN_MAX_ATTEMPTS = 10;
/** Rate limit window in minutes */
const SIGN_IN_WINDOW_MINUTES = 15;

authRoutes.post('/signin', jsonBody(signInSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const parsed = c.req.valid('json');

  const email = parsed.email.toLowerCase().trim();
  const emailHash = await sha256(email);

  // Rate limit check BEFORE password verification to limit brute-force
  const recentAttempts = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loginAttempts)
    .where(
      sql`${loginAttempts.emailHash} = ${emailHash} AND ${loginAttempts.attemptedAt} > datetime('now', ${`-${SIGN_IN_WINDOW_MINUTES}`} || ' minutes')`,
    )
    .get();

  if (recentAttempts && recentAttempts.count >= SIGN_IN_MAX_ATTEMPTS) {
    return c.json({ success: false, reason: 'TOO_MANY_ATTEMPTS' }, 429);
  }

  const user = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      customAvatarUrl: users.customAvatarUrl,
      avatarFrame: users.avatarFrame,
      equippedFlair: users.equippedFlair,
      equippedNameStyle: users.equippedNameStyle,
      equippedEffect: users.equippedEffect,
      equippedSeatAnimation: users.equippedSeatAnimation,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user || !user.passwordHash) {
    await recordFailedLogin(env, emailHash);
    return c.json({ success: false, reason: 'INVALID_CREDENTIALS' }, 401);
  }

  const result = await verifyPassword(parsed.password, user.passwordHash);
  if (!result.valid) {
    await recordFailedLogin(env, emailHash);
    return c.json({ success: false, reason: 'INVALID_CREDENTIALS' }, 401);
  }

  // Successful login — clear failed attempts for this email
  await db.delete(loginAttempts).where(eq(loginAttempts.emailHash, emailHash));

  // Update geo + lazy migration: bcrypt → PBKDF2 rehash on first successful login
  const geo = requestGeo(c);
  if (result.needsRehash && result.newHash) {
    await db
      .update(users)
      .set({ passwordHash: result.newHash, ...geo, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, user.id));
    log.info('rehashed password (bcrypt → PBKDF2)', { userId: user.id });
  } else {
    await db
      .update(users)
      .set({ ...geo, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, user.id));
  }

  const tokens = await issueTokenPair(user.id, env, { email, ver: user.tokenVersion });

  return c.json(
    {
      ...tokens,
      user: {
        id: user.id,
        email,
        is_anonymous: false,
        user_metadata: toUserMetadata(user),
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/user — 获取当前用户信息（通过 JWT）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.get('/user', async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const token = extractBearerToken(c.req.raw);
  if (!token) {
    return c.json({ success: false, reason: 'UNAUTHORIZED' }, 401);
  }

  const payload = await verifyToken(token, env);
  if (!payload) {
    return c.json({ success: false, reason: 'UNAUTHORIZED' }, 401);
  }

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      customAvatarUrl: users.customAvatarUrl,
      avatarFrame: users.avatarFrame,
      equippedFlair: users.equippedFlair,
      equippedNameStyle: users.equippedNameStyle,
      equippedEffect: users.equippedEffect,
      equippedSeatAnimation: users.equippedSeatAnimation,
      isAnonymous: users.isAnonymous,
      wechatOpenid: users.wechatOpenid,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (!user) {
    return c.json({ success: false, reason: 'USER_NOT_FOUND' }, 404);
  }

  // Verify token version (revocation check)
  if (user.tokenVersion !== payload.ver) {
    return c.json({ success: false, reason: 'TOKEN_REVOKED' }, 401);
  }

  return c.json(
    {
      data: {
        user: {
          id: user.id,
          email: user.email,
          is_anonymous: user.isAnonymous === 1,
          has_wechat: !!user.wechatOpenid,
          user_metadata: toUserMetadata(user),
        },
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /auth/profile — 更新用户资料
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.put('/profile', requireAuth, jsonBody(updateProfileSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  // ── Validate cosmetic equip ownership ──────────────────────────────────
  // Empty string means "unequip" and is always allowed.
  const cosmeticFields = {
    avatarFrame: parsed.avatarFrame,
    seatFlair: parsed.seatFlair,
    nameStyle: parsed.nameStyle,
    equippedEffect: parsed.equippedEffect,
    seatAnimation: parsed.seatAnimation,
  };
  const needsOwnershipCheck = Object.values(cosmeticFields).some(
    (v) => v !== undefined && v !== '',
  );

  if (needsOwnershipCheck) {
    const stats = await db
      .select({ unlockedItems: userStats.unlockedItems })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();
    const unlockedIds: readonly string[] = stats
      ? (JSON.parse(stats.unlockedItems) as string[])
      : [];

    if (cosmeticFields.avatarFrame && !isFrameUnlocked(cosmeticFields.avatarFrame, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'avatarFrame' }, 403);
    }
    if (cosmeticFields.seatFlair && !isFlairUnlocked(cosmeticFields.seatFlair, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'seatFlair' }, 403);
    }
    if (cosmeticFields.nameStyle && !isNameStyleUnlocked(cosmeticFields.nameStyle, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'nameStyle' }, 403);
    }
    if (
      cosmeticFields.equippedEffect &&
      !isRoleRevealEffectUnlocked(cosmeticFields.equippedEffect, unlockedIds)
    ) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'equippedEffect' }, 403);
    }
    if (
      cosmeticFields.seatAnimation &&
      !isSeatAnimationUnlocked(cosmeticFields.seatAnimation, unlockedIds)
    ) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'seatAnimation' }, 403);
    }
  }

  // Build set object for only provided fields
  const set: Record<string, unknown> = {};

  if (parsed.displayName !== undefined) set.displayName = parsed.displayName;
  if (parsed.avatarUrl !== undefined) set.avatarUrl = parsed.avatarUrl;
  if (parsed.customAvatarUrl !== undefined) set.customAvatarUrl = parsed.customAvatarUrl;
  if (parsed.avatarFrame !== undefined) set.avatarFrame = parsed.avatarFrame;
  if (parsed.seatFlair !== undefined) set.equippedFlair = parsed.seatFlair;
  if (parsed.nameStyle !== undefined) set.equippedNameStyle = parsed.nameStyle;
  if (parsed.equippedEffect !== undefined) set.equippedEffect = parsed.equippedEffect;
  if (parsed.seatAnimation !== undefined) set.equippedSeatAnimation = parsed.seatAnimation;

  if (Object.keys(set).length === 0) {
    return c.json({ success: true }, 200);
  }

  set.updatedAt = sql`datetime('now')`;

  await db.update(users).set(set).where(eq(users.id, userId));

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /auth/password — 修改密码（已登录用户）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.put('/password', requireAuth, jsonBody(changePasswordSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  const user = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user || !user.passwordHash) {
    return c.json({ success: false, reason: 'NO_PASSWORD' }, 400);
  }

  const result = await verifyPassword(parsed.oldPassword, user.passwordHash);
  if (!result.valid) {
    return c.json({ success: false, reason: 'INVALID_OLD_PASSWORD' }, 401);
  }

  const newHash = await hashPassword(parsed.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  // Revoke all tokens — user must re-login with new password
  await bumpTokenVersion(userId, env);
  await revokeAllRefreshTokens(userId, env);

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signout — 登出（revoke tokens，使所有设备下线）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/signout', requireAuth, async (c) => {
  const userId = c.var.userId;
  const env = c.env;

  // Bump token version to invalidate all access tokens
  await bumpTokenVersion(userId, env);
  // Delete all refresh tokens
  await revokeAllRefreshTokens(userId, env);

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password — 发送密码重置验证码邮件
// ─────────────────────────────────────────────────────────────────────────────

/** Rate limit: max reset requests per email per hour */
const RESET_RATE_LIMIT = 3;
/** Reset code TTL in minutes */
const RESET_CODE_TTL_MINUTES = 15;
/** Max verification attempts per reset code before invalidation */
const RESET_VERIFY_ATTEMPT_LIMIT = 5;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function recordFailedLogin(env: Env, emailHash: string): Promise<void> {
  const db = createDb(env.DB);
  await db.insert(loginAttempts).values({
    id: sql`lower(hex(randomblob(16)))`,
    emailHash,
    attemptedAt: sql`datetime('now')`,
  });
}

/** Fetch the stored token_hash for a given token id (used after attempt-count check). */
async function getTokenHash(tokenId: string, env: Env): Promise<string | null> {
  const db = createDb(env.DB);
  const row = await db
    .select({ tokenHash: passwordResetTokens.tokenHash })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.id, tokenId))
    .get();
  return row?.tokenHash ?? null;
}

authRoutes.post('/forgot-password', jsonBody(forgotPasswordSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const parsed = c.req.valid('json');

  const email = parsed.email.toLowerCase().trim();

  // Rate limit BEFORE user lookup to avoid email enumeration via 429 vs 200.
  const recentCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      sql`${users.email} = ${email} AND ${passwordResetTokens.createdAt} > datetime('now', '-1 hour')`,
    )
    .get();

  if (recentCount && recentCount.count >= RESET_RATE_LIMIT) {
    // Return 200 (not 429) so attackers cannot distinguish registered vs unregistered
    return c.json({ success: true }, 200);
  }

  // Check user exists (non-anonymous with password)
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(
      sql`${users.email} = ${email} AND ${users.isAnonymous} = 0 AND ${users.passwordHash} IS NOT NULL`,
    )
    .get();

  if (!user) {
    // Don't reveal whether email exists — return success either way
    return c.json({ success: true }, 200);
  }

  // Invalidate any previous unused tokens for this user
  await db
    .update(passwordResetTokens)
    .set({ isUsed: 1 })
    .where(sql`${passwordResetTokens.userId} = ${user.id} AND ${passwordResetTokens.isUsed} = 0`);

  // Generate 6-digit code (CSPRNG) and store hashed
  const randomBuf = new Uint32Array(1);
  crypto.getRandomValues(randomBuf);
  const code = String(100000 + (randomBuf[0] % 900000));
  const tokenHash = await sha256(code + email);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000).toISOString();

  await db.insert(passwordResetTokens).values({
    id: sql`lower(hex(randomblob(16)))`,
    userId: user.id,
    tokenHash,
    expiresAt,
    createdAt: sql`datetime('now')`,
  });

  // Send email (fire-and-forget resilience: if email fails, user can retry)
  try {
    await sendPasswordResetEmail(env, email, code);
  } catch (error) {
    log.error('failed to send reset email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: false, reason: 'EMAIL_SEND_FAILED' }, 500);
  }

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password — 验证码重置密码 + 自动登录
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/reset-password', jsonBody(resetPasswordSchema), async (c) => {
  const env = c.env;
  const db = createDb(env.DB);
  const parsed = c.req.valid('json');

  const email = parsed.email.toLowerCase().trim();
  const tokenHash = await sha256(parsed.code + email);

  // Find valid token (also check verify_attempts limit)
  const token = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      verifyAttempts: passwordResetTokens.verifyAttempts,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(passwordResetTokens.userId, users.id))
    .where(
      sql`${users.email} = ${email} AND ${passwordResetTokens.isUsed} = 0 AND ${passwordResetTokens.expiresAt} > datetime('now')`,
    )
    .orderBy(sql`${passwordResetTokens.createdAt} DESC`)
    .limit(1)
    .get();

  if (!token || token.verifyAttempts >= RESET_VERIFY_ATTEMPT_LIMIT) {
    return c.json({ success: false, reason: 'INVALID_OR_EXPIRED_CODE' }, 400);
  }

  // Increment verify attempts before checking hash to prevent brute force
  await db
    .update(passwordResetTokens)
    .set({ verifyAttempts: sql`${passwordResetTokens.verifyAttempts} + 1` })
    .where(eq(passwordResetTokens.id, token.id));

  // Invalidate token if attempt limit now reached
  if (token.verifyAttempts + 1 >= RESET_VERIFY_ATTEMPT_LIMIT) {
    await db
      .update(passwordResetTokens)
      .set({ isUsed: 1 })
      .where(eq(passwordResetTokens.id, token.id));
  }

  // Verify hash
  if (tokenHash !== (await getTokenHash(token.id, env))) {
    return c.json({ success: false, reason: 'INVALID_OR_EXPIRED_CODE' }, 400);
  }

  // Mark token as used
  await db
    .update(passwordResetTokens)
    .set({ isUsed: 1 })
    .where(eq(passwordResetTokens.id, token.id));

  // Update password + revoke old tokens
  const newHash = await hashPassword(parsed.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, token.userId));

  const newVer = await bumpTokenVersion(token.userId, env);
  await revokeAllRefreshTokens(token.userId, env);

  // Auto-login: issue new token pair
  const tokens = await issueTokenPair(token.userId, env, { email, ver: newVer });

  // Fetch user metadata for response
  const profile = await selectUserProfile(db, token.userId);

  return c.json(
    {
      success: true,
      ...tokens,
      user: {
        id: token.userId,
        email,
        is_anonymous: false,
        user_metadata: toUserMetadata(profile),
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/wechat — 微信小程序登录（wx.login code → openid → JWT）
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/wechat', jsonBody(wechatCodeSchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return c.json({ success: false, reason: 'WECHAT_NOT_CONFIGURED' }, 500);
  }

  // Exchange code for openid via WeChatAuthProxy DO (locationHint: "apac")
  // DO runs in APAC, reducing latency to api.weixin.qq.com (China) from ~300-500ms to ~50ms
  const wxStub = getWeChatAuthStub(env);
  let wxData: { openid?: string; errcode?: number; errmsg?: string };
  try {
    wxData = await wxStub.code2Session(parsed.code, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET);
  } catch (err) {
    log.warn('wechat code2Session timeout', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ success: false, reason: 'WECHAT_TIMEOUT' }, 504);
  }

  if (!wxData.openid) {
    return c.json({ success: false, reason: 'WECHAT_AUTH_FAILED', errcode: wxData.errcode }, 401);
  }

  const openid = wxData.openid;

  // Look up existing user by wechat_openid
  const db = createDb(env.DB);
  const existing = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      customAvatarUrl: users.customAvatarUrl,
      avatarFrame: users.avatarFrame,
      equippedFlair: users.equippedFlair,
      equippedNameStyle: users.equippedNameStyle,
      equippedEffect: users.equippedEffect,
      equippedSeatAnimation: users.equippedSeatAnimation,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.wechatOpenid, openid))
    .get();

  const geo = requestGeo(c);

  if (existing) {
    // Update geo on login
    await db
      .update(users)
      .set({ ...geo, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, existing.id));

    const tokens = await issueTokenPair(existing.id, env, {
      email: existing.email ?? undefined,
      ver: existing.tokenVersion,
    });

    return c.json(
      {
        ...tokens,
        user: {
          id: existing.id,
          email: existing.email,
          is_anonymous: false,
          user_metadata: toUserMetadata(existing),
        },
      },
      200,
    );
  }

  // Create new user with wechat_openid
  const userId = crypto.randomUUID();
  const now = sql`datetime('now')`;

  await db.insert(users).values({
    id: userId,
    wechatOpenid: openid,
    isAnonymous: 0,
    ...geo,
    createdAt: now,
    updatedAt: now,
  });

  // Welcome bonus for new WeChat user
  await grantWelcomeBonus(db, userId);

  const tokens = await issueTokenPair(userId, env, { ver: 0 });

  return c.json(
    {
      ...tokens,
      user: {
        id: userId,
        email: null,
        is_anonymous: false,
        user_metadata: toUserMetadata(null),
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/bind-wechat — 已登录用户绑定微信（邮箱账号 + wxcode → 绑定 openid）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/bind-wechat', requireAuth, jsonBody(wechatCodeSchema), async (c) => {
  const env = c.env;
  const userId = c.var.userId;
  const parsed = c.req.valid('json');

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return c.json({ success: false, reason: 'WECHAT_NOT_CONFIGURED' }, 500);
  }

  // Exchange code for openid via WeChatAuthProxy DO (locationHint: "apac")
  const wxStub = getWeChatAuthStub(env);
  let wxData: { openid?: string; errcode?: number; errmsg?: string };
  try {
    wxData = await wxStub.code2Session(parsed.code, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET);
  } catch (err) {
    log.warn('bind-wechat code2Session timeout', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ success: false, reason: 'WECHAT_TIMEOUT' }, 504);
  }

  if (!wxData.openid) {
    return c.json({ success: false, reason: 'WECHAT_AUTH_FAILED', errcode: wxData.errcode }, 401);
  }

  const openid = wxData.openid;

  // Check if openid is already bound to another user
  const db = createDb(env.DB);
  const existingWxUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.wechatOpenid, openid))
    .get();

  if (existingWxUser) {
    if (existingWxUser.id === userId) {
      // Already bound to same user — no-op
      return c.json({ success: true }, 200);
    }
    // Bound to a different user — check if it's a temporary WeChat-only account
    const wxUser = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, existingWxUser.id))
      .get();

    if (wxUser && !wxUser.email && !wxUser.passwordHash) {
      // Temporary WeChat account (no email, no password) — safe to delete and rebind
      await db.delete(users).where(eq(users.id, wxUser.id));
    } else {
      return c.json({ success: false, reason: 'WECHAT_ALREADY_BOUND' }, 409);
    }
  }

  // Bind openid to current user
  await db
    .update(users)
    .set({ wechatOpenid: openid, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh — Refresh token rotation（换取新 access + refresh token）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/refresh', jsonBody(refreshTokenSchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');

  const result = await rotateRefreshToken(parsed.refresh_token, env);
  if (!result) {
    return c.json({ success: false, reason: 'INVALID_REFRESH_TOKEN' }, 401);
  }

  return c.json(
    {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    },
    200,
  );
});
