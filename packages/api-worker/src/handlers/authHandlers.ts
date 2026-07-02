/**
 * Auth Route Handlers — self-implemented auth API (Hono routes)
 *
 * Covers anonymous login, email signup/signin, profile update, session recovery.
 * JWT issuing/verification; passwords hashed via PBKDF2 and stored in D1.
 *
 * @throws HTTP error codes thrown/returned by each route:
 * - POST /auth/anonymous — no special errors
 * - POST /auth/signup — 409 EMAIL_ALREADY_REGISTERED | 409 ROOM_CODE_CONFLICT (merge) | 500 ACCOUNT_MERGE_FAILED
 * - POST /auth/signin — 429 TOO_MANY_ATTEMPTS (10/15min) | 401 INVALID_CREDENTIALS
 * - GET /auth/user — 401 token missing/invalid/revoked | 404 user deleted
 * - PUT /auth/profile — 403 equipped item not unlocked
 * - PUT /auth/password — 400 NO_PASSWORD (anonymous/WeChat user) | 401 old password incorrect
 * - POST /auth/signout — no special errors
 * - POST /auth/forgot-password — 500 EMAIL_SEND_FAILED
 * - POST /auth/reset-password — 400 INVALID_OR_EXPIRED_CODE (expired/5-attempt limit/already used)
 * - POST /auth/refresh — 401 INVALID_REFRESH_TOKEN
 * - POST /auth/wechat-claim — 500 WECHAT_NOT_CONFIGURED | 504 WECHAT_TIMEOUT | 401 WECHAT_AUTH_FAILED
 * - POST /auth/claim — 404 nonce not found | 410 CLAIM_EXPIRED (>2 minutes)
 * - POST /auth/claim-bind — 404 | 410 | 409 OPENID_ALREADY_BOUND
 */

import { ROLE_REVEAL_EFFECT_IDS } from '@werewolf/game-engine/cosmetics/roleRevealEffects';
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
import {
  drawHistory,
  loginAttempts,
  passwordResetTokens,
  users,
  userStats,
  wxClaims,
} from '../db/schema';
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
  claimNonceSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  wechatClaimSchema,
} from '../schemas/auth';
import { getWeChatAuthStub, jsonBody } from './shared';
import { selectUserProfile, toUserMetadata } from './userProfile';

const log = createLogger('auth');

/** Auth-related routes (signup/signin/refresh/password reset). */
export const authRoutes = new Hono<AppEnv>();

/** Extract Cloudflare edge geo from incoming request. */
function requestGeo(c: { req: { raw: Request } }) {
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  return {
    lastCountry: (cf?.country as string) ?? null,
    lastColo: (cf?.colo as string) ?? null,
  };
}

/** Signup welcome bonus: 5 normal tickets + 1 golden ticket */
const WELCOME_NORMAL_DRAWS = 5;
const WELCOME_GOLDEN_DRAWS = 1;

/** Grant welcome draw tickets to a newly registered user (upsert; accumulates if row exists) */
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
// POST /auth/anonymous — anonymous login
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
// POST /auth/signup — email signup (or anonymous upgrade)
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
// POST /auth/signin — email + password login
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
// GET /auth/user — fetch current user info (via JWT)
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
// PUT /auth/profile — update user profile
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
      (ROLE_REVEAL_EFFECT_IDS as readonly string[]).includes(cosmeticFields.equippedEffect) &&
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
// PUT /auth/password — change password (authenticated user)
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
// POST /auth/signout — sign out (revoke tokens, log out all devices)
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
// POST /auth/forgot-password — send password reset verification code email
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
// POST /auth/reset-password — reset password via verification code + auto sign-in
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
// POST /auth/refresh — refresh token rotation (exchange for new access + refresh token)
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/wechat-claim — mini-program native-side pre-login (code + nonce -> store openid for later claim)
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/wechat-claim', jsonBody(wechatClaimSchema), async (c) => {
  const env = c.env;
  const { code, nonce } = c.req.valid('json');

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return c.json({ success: false, reason: 'WECHAT_NOT_CONFIGURED' }, 500);
  }

  // Exchange code for openid via WeChatAuthProxy DO
  const wxStub = getWeChatAuthStub(env);
  let wxData: { openid?: string; errcode?: number; errmsg?: string };
  try {
    wxData = await wxStub.code2Session(code, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET);
  } catch (err) {
    log.warn('wechat-claim code2Session timeout', {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ success: false, reason: 'WECHAT_TIMEOUT' }, 504);
  }

  if (!wxData.openid) {
    return c.json({ success: false, reason: 'WECHAT_AUTH_FAILED', errcode: wxData.errcode }, 401);
  }

  const openid = wxData.openid;
  const db = createDb(env.DB);

  // Store openid by nonce (upsert: if same nonce retried, overwrite)
  await db
    .insert(wxClaims)
    .values({
      nonce,
      openid,
      createdAt: sql`datetime('now')`,
    })
    .onConflictDoUpdate({
      target: wxClaims.nonce,
      set: {
        openid,
        createdAt: sql`datetime('now')`,
      },
    });

  log.info('wechat-claim prepared', { nonce: nonce.slice(0, 8) });
  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/claim — web-view redeems openid by nonce -> sign in / sign up
// ─────────────────────────────────────────────────────────────────────────────

const CLAIM_TTL_MS = 120_000; // 2 minutes

authRoutes.post('/claim', jsonBody(claimNonceSchema), async (c) => {
  const env = c.env;
  const { nonce } = c.req.valid('json');
  const db = createDb(env.DB);

  const claim = await db.select().from(wxClaims).where(eq(wxClaims.nonce, nonce)).get();

  if (!claim) {
    return c.json({ success: false, reason: 'CLAIM_NOT_FOUND' }, 404);
  }

  // Check TTL
  const createdAt = new Date(claim.createdAt + 'Z').getTime();
  if (Date.now() - createdAt > CLAIM_TTL_MS) {
    await db.delete(wxClaims).where(eq(wxClaims.nonce, nonce));
    return c.json({ success: false, reason: 'CLAIM_EXPIRED' }, 410);
  }

  // Delete claim (one-time use)
  await db.delete(wxClaims).where(eq(wxClaims.nonce, nonce));

  const { openid } = claim;
  const geo = requestGeo(c);

  // Find or create user by openid
  let userId: string;
  const existing = await db
    .select({ id: users.id, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.wechatOpenid, openid))
    .get();

  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ ...geo, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, userId));
  } else {
    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      wechatOpenid: openid,
      isAnonymous: 0,
      ...geo,
      createdAt: sql`datetime('now')`,
      updatedAt: sql`datetime('now')`,
    });
    await grantWelcomeBonus(db, userId);
  }

  // Issue tokens
  const tokenVersion = existing?.tokenVersion ?? 0;
  const tokens = await issueTokenPair(userId, env, { ver: tokenVersion });

  // Fetch user for response
  const user = await db
    .select({ id: users.id, email: users.email, isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  const profile = await selectUserProfile(db, userId);

  log.info('claim redeemed', { userId, nonce: nonce.slice(0, 8) });
  return c.json(
    {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        id: userId,
        email: user?.email ?? null,
        is_anonymous: !!user?.isAnonymous,
        has_wechat: true,
        user_metadata: toUserMetadata(profile),
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/claim-bind — web-view uses nonce to bind openid to existing user
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/claim-bind', requireAuth, jsonBody(claimNonceSchema), async (c) => {
  const env = c.env;
  const { nonce } = c.req.valid('json');
  const userId = c.var.userId;
  const db = createDb(env.DB);

  const claim = await db.select().from(wxClaims).where(eq(wxClaims.nonce, nonce)).get();

  if (!claim) {
    return c.json({ success: false, reason: 'CLAIM_NOT_FOUND' }, 404);
  }

  // Check TTL
  const createdAt = new Date(claim.createdAt + 'Z').getTime();
  if (Date.now() - createdAt > CLAIM_TTL_MS) {
    await db.delete(wxClaims).where(eq(wxClaims.nonce, nonce));
    return c.json({ success: false, reason: 'CLAIM_EXPIRED' }, 410);
  }

  // Delete claim (one-time use)
  await db.delete(wxClaims).where(eq(wxClaims.nonce, nonce));

  const { openid } = claim;

  // Check if openid is already bound to another user
  const existingOwner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.wechatOpenid, openid))
    .get();

  if (existingOwner && existingOwner.id !== userId) {
    return c.json({ success: false, reason: 'OPENID_ALREADY_BOUND' }, 409);
  }

  // Bind openid to authenticated user
  await db
    .update(users)
    .set({ wechatOpenid: openid, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  log.info('claim-bind succeeded', { userId, nonce: nonce.slice(0, 8) });
  return c.json({ success: true }, 200);
});
