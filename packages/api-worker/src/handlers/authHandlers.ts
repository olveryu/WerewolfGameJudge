/**
 * Auth Route Handlers — 自实现认证 API (Hono routes)
 *
 * 覆盖匿名登录、邮箱注册/登录、用户资料更新、session 恢复。
 * JWT 签发/验证，密码用 PBKDF2 哈希存储到 D1。
 * 与 Supabase Auth 语义兼容（匿名 + 邮箱）。
 */

import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { loginAttempts, passwordResetTokens, users, userStats } from '../db/schema';
import type { AppEnv, Env } from '../env';
import { extractBearerToken, requireAuth, signToken, verifyToken } from '../lib/auth';
import { sendPasswordResetEmail } from '../lib/email';
import { hashPassword, verifyPassword } from '../lib/password';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  wechatCodeSchema,
} from '../schemas/auth';
import { jsonBody } from './shared';

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

  const token = await signToken(userId, env, { anon: true });

  return c.json(
    {
      access_token: token,
      user: { id: userId, is_anonymous: true, email: null, user_metadata: {} },
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
        return c.json({ error: 'email already registered' }, 409);
      }

      // Password is required for merge verification
      const mergeResult = await verifyPassword(parsed.password, existing.passwordHash);
      if (!mergeResult.valid) {
        return c.json({ error: 'invalid credentials' }, 401);
      }

      // Migrate openid to the email account and delete the WeChat shell account.
      // Use batch() for atomicity: clear openid → transfer → delete, all-or-nothing.
      try {
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
        console.error('Account merge DB error:', msg);
        return c.json({ error: 'account merge failed' }, 500);
      }

      // Read back merged account profile
      const merged = await db
        .select({
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          customAvatarUrl: users.customAvatarUrl,
          avatarFrame: users.avatarFrame,
          equippedFlair: users.equippedFlair,
          equippedNameStyle: users.equippedNameStyle,
        })
        .from(users)
        .where(eq(users.id, existing.id))
        .get();

      const token = await signToken(existing.id, env, { email });

      return c.json(
        {
          access_token: token,
          user: {
            id: existing.id,
            email,
            is_anonymous: false,
            user_metadata: {
              display_name: merged?.displayName,
              avatar_url: merged?.avatarUrl,
              custom_avatar_url: merged?.customAvatarUrl,
              avatar_frame: merged?.avatarFrame,
              seat_flair: merged?.equippedFlair,
              name_style: merged?.equippedNameStyle,
            },
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

    // Read back the actual display_name (may be the pre-existing one)
    const upgraded = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, existingUserId))
      .get();

    const token = await signToken(existingUserId, env, { email });

    return c.json(
      {
        access_token: token,
        user: {
          id: existingUserId,
          email,
          is_anonymous: false,
          user_metadata: { display_name: upgraded?.displayName ?? displayName },
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
    return c.json({ error: 'email already registered' }, 409);
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

  const token = await signToken(userId, env, { email });

  return c.json(
    {
      access_token: token,
      user: {
        id: userId,
        email,
        is_anonymous: false,
        user_metadata: { display_name: displayName },
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
    return c.json({ error: 'too many login attempts, try again later' }, 429);
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
    })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user || !user.passwordHash) {
    await recordFailedLogin(env, emailHash);
    return c.json({ error: 'invalid credentials' }, 401);
  }

  const result = await verifyPassword(parsed.password, user.passwordHash);
  if (!result.valid) {
    await recordFailedLogin(env, emailHash);
    return c.json({ error: 'invalid credentials' }, 401);
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
    console.log(`Rehashed password for user ${user.id} (bcrypt → PBKDF2)`);
  } else {
    await db
      .update(users)
      .set({ ...geo, updatedAt: sql`datetime('now')` })
      .where(eq(users.id, user.id));
  }

  const token = await signToken(user.id, env, { email });

  return c.json(
    {
      access_token: token,
      user: {
        id: user.id,
        email,
        is_anonymous: false,
        user_metadata: {
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          custom_avatar_url: user.customAvatarUrl,
          avatar_frame: user.avatarFrame,
          seat_flair: user.equippedFlair,
          name_style: user.equippedNameStyle,
        },
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
    return c.json({ data: { user: null } }, 200);
  }

  const payload = await verifyToken(token, env);
  if (!payload) {
    return c.json({ data: { user: null } }, 200);
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
      isAnonymous: users.isAnonymous,
      wechatOpenid: users.wechatOpenid,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (!user) {
    return c.json({ data: { user: null } }, 200);
  }

  return c.json(
    {
      data: {
        user: {
          id: user.id,
          email: user.email,
          is_anonymous: user.isAnonymous === 1,
          has_wechat: !!user.wechatOpenid,
          user_metadata: {
            display_name: user.displayName,
            avatar_url: user.avatarUrl,
            custom_avatar_url: user.customAvatarUrl,
            avatar_frame: user.avatarFrame,
            seat_flair: user.equippedFlair,
            name_style: user.equippedNameStyle,
          },
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

  // Build set object for only provided fields
  const set: Record<string, unknown> = {};

  if (parsed.displayName !== undefined) set.displayName = parsed.displayName;
  if (parsed.avatarUrl !== undefined) set.avatarUrl = parsed.avatarUrl;
  if (parsed.customAvatarUrl !== undefined) set.customAvatarUrl = parsed.customAvatarUrl;
  if (parsed.avatarFrame !== undefined) set.avatarFrame = parsed.avatarFrame;
  if (parsed.seatFlair !== undefined) set.equippedFlair = parsed.seatFlair;
  if (parsed.nameStyle !== undefined) set.equippedNameStyle = parsed.nameStyle;

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
    return c.json({ error: 'account has no password (anonymous user)' }, 400);
  }

  const result = await verifyPassword(parsed.oldPassword, user.passwordHash);
  if (!result.valid) {
    return c.json({ error: 'invalid old password' }, 401);
  }

  const newHash = await hashPassword(parsed.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  return c.json({ success: true }, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signout — 登出（JWT 是无状态的，客户端清除 token 即可）
// ─────────────────────────────────────────────────────────────────────────────
authRoutes.post('/signout', async (c) => {
  // JWT is stateless — signout is client-side token removal.
  // Server acknowledges; any future request with old token still validates until expiry.
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
    .set({ used: 1 })
    .where(sql`${passwordResetTokens.userId} = ${user.id} AND ${passwordResetTokens.used} = 0`);

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
    console.error('Failed to send reset email:', error);
    return c.json({ error: 'failed to send email, try again later' }, 500);
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
      sql`${users.email} = ${email} AND ${passwordResetTokens.used} = 0 AND ${passwordResetTokens.expiresAt} > datetime('now')`,
    )
    .orderBy(sql`${passwordResetTokens.createdAt} DESC`)
    .limit(1)
    .get();

  if (!token || token.verifyAttempts >= RESET_VERIFY_ATTEMPT_LIMIT) {
    return c.json({ error: 'invalid or expired code' }, 400);
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
      .set({ used: 1 })
      .where(eq(passwordResetTokens.id, token.id));
  }

  // Verify hash
  if (tokenHash !== (await getTokenHash(token.id, env))) {
    return c.json({ error: 'invalid or expired code' }, 400);
  }

  // Mark token as used
  await db.update(passwordResetTokens).set({ used: 1 }).where(eq(passwordResetTokens.id, token.id));

  // Update password
  const newHash = await hashPassword(parsed.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, token.userId));

  // Auto-login: return JWT
  const jwt = await signToken(token.userId, env, { email });

  // Fetch user metadata for response
  const user = await db
    .select({
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      customAvatarUrl: users.customAvatarUrl,
      avatarFrame: users.avatarFrame,
      equippedFlair: users.equippedFlair,
      equippedNameStyle: users.equippedNameStyle,
    })
    .from(users)
    .where(eq(users.id, token.userId))
    .get();

  return c.json(
    {
      success: true,
      access_token: jwt,
      user: {
        id: token.userId,
        email,
        is_anonymous: false,
        user_metadata: {
          display_name: user?.displayName,
          avatar_url: user?.avatarUrl,
          custom_avatar_url: user?.customAvatarUrl,
          avatar_frame: user?.avatarFrame,
          seat_flair: user?.equippedFlair,
          name_style: user?.equippedNameStyle,
        },
      },
    },
    200,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/wechat — 微信小程序登录（wx.login code → openid → JWT）
// ─────────────────────────────────────────────────────────────────────────────

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

authRoutes.post('/wechat', jsonBody(wechatCodeSchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return c.json({ error: 'WeChat login not configured' }, 500);
  }

  // Exchange code for openid via WeChat code2Session API
  const wxUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  wxUrl.searchParams.set('appid', env.WECHAT_APP_ID);
  wxUrl.searchParams.set('secret', env.WECHAT_APP_SECRET);
  wxUrl.searchParams.set('js_code', parsed.code);
  wxUrl.searchParams.set('grant_type', 'authorization_code');

  const wxResp = await fetch(wxUrl.toString());
  const wxData: WechatCode2SessionResponse = await wxResp.json();

  if (!wxData.openid) {
    const errMsg = wxData.errmsg || 'code2Session failed';
    return c.json({ error: errMsg, errcode: wxData.errcode }, 401);
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

    const token = await signToken(existing.id, env, {
      email: existing.email ?? undefined,
    });

    return c.json(
      {
        access_token: token,
        user: {
          id: existing.id,
          email: existing.email,
          is_anonymous: false,
          user_metadata: {
            display_name: existing.displayName,
            avatar_url: existing.avatarUrl,
            custom_avatar_url: existing.customAvatarUrl,
            avatar_frame: existing.avatarFrame,
            seat_flair: existing.equippedFlair,
            name_style: existing.equippedNameStyle,
          },
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

  const token = await signToken(userId, env);

  return c.json(
    {
      access_token: token,
      user: {
        id: userId,
        email: null,
        is_anonymous: false,
        user_metadata: {},
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
    return c.json({ error: 'WeChat login not configured' }, 500);
  }

  // Exchange code for openid
  const wxUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  wxUrl.searchParams.set('appid', env.WECHAT_APP_ID);
  wxUrl.searchParams.set('secret', env.WECHAT_APP_SECRET);
  wxUrl.searchParams.set('js_code', parsed.code);
  wxUrl.searchParams.set('grant_type', 'authorization_code');

  const wxResp = await fetch(wxUrl.toString());
  const wxData: WechatCode2SessionResponse = await wxResp.json();

  if (!wxData.openid) {
    const errMsg = wxData.errmsg || 'code2Session failed';
    return c.json({ error: errMsg, errcode: wxData.errcode }, 401);
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
      return c.json({ error: 'wechat_already_bound' }, 409);
    }
  }

  // Bind openid to current user
  await db
    .update(users)
    .set({ wechatOpenid: openid, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  return c.json({ success: true }, 200);
});
