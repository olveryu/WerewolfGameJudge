/**
 * Auth Route Handlers — 自实现认证 API
 *
 * 覆盖匿名登录、邮箱注册/登录、用户资料更新、session 恢复。
 * JWT 签发/验证，密码用 PBKDF2 哈希存储到 D1。
 * 与 Supabase Auth 语义兼容（匿名 + 邮箱）。
 */

import type { Env } from '../env';
import { extractBearerToken, signToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import { sendPasswordResetEmail } from '../lib/email';
import { hashPassword, verifyPassword } from '../lib/password';

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/anonymous — 匿名登录
// ─────────────────────────────────────────────────────────────────────────────
export async function handleAnonymousSignIn(_request: Request, env: Env): Promise<Response> {
  const userId = crypto.randomUUID();

  await env.DB.prepare(`INSERT INTO users (id, is_anonymous) VALUES (?, 1)`).bind(userId).run();

  const token = await signToken(userId, env, { anon: true });

  return jsonResponse(
    {
      access_token: token,
      user: { id: userId, is_anonymous: true, email: null, user_metadata: {} },
    },
    200,
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signup — 邮箱注册（或匿名升级）
// ─────────────────────────────────────────────────────────────────────────────
export async function handleSignUp(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!body.email || !body.password) {
    return jsonResponse({ error: 'email and password required' }, 400, env);
  }

  const email = body.email.toLowerCase().trim();
  const displayName = body.displayName || email.split('@')[0];

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
        const row = await env.DB.prepare('SELECT email, password_hash FROM users WHERE id = ?')
          .bind(payload.sub)
          .first<{ email: string | null; password_hash: string | null }>();
        if (row && !row.email && !row.password_hash) {
          existingUserId = payload.sub;
        }
      }
    }
  }

  const passwordHash = await hashPassword(body.password);

  if (existingUserId) {
    // In-place upgrade (anonymous or WeChat-only → email): preserve UID + existing profile
    // Check email not already taken by another user
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();

    if (existing) {
      return jsonResponse({ error: 'email already registered' }, 409, env);
    }

    // Only overwrite display_name if caller explicitly provided one
    const updateName = body.displayName ? displayName : null;

    await env.DB.prepare(
      `UPDATE users
       SET email = ?, password_hash = ?,
           display_name = COALESCE(?, display_name, ?),
           is_anonymous = 0, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(email, passwordHash, updateName, displayName, existingUserId)
      .run();

    // Read back the actual display_name (may be the pre-existing one)
    const upgraded = await env.DB.prepare('SELECT display_name FROM users WHERE id = ?')
      .bind(existingUserId)
      .first<{ display_name: string | null }>();

    const token = await signToken(existingUserId, env, { email });

    return jsonResponse(
      {
        access_token: token,
        user: {
          id: existingUserId,
          email,
          is_anonymous: false,
          user_metadata: { display_name: upgraded?.display_name ?? displayName },
        },
      },
      200,
      env,
    );
  }

  // New user registration
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();

  if (existing) {
    return jsonResponse({ error: 'email already registered' }, 409, env);
  }

  const userId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, is_anonymous)
     VALUES (?, ?, ?, ?, 0)`,
  )
    .bind(userId, email, passwordHash, displayName)
    .run();

  const token = await signToken(userId, env, { email });

  return jsonResponse(
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
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signin — 邮箱密码登录
// ─────────────────────────────────────────────────────────────────────────────

/** Max failed login attempts per email within the rate limit window */
const SIGN_IN_MAX_ATTEMPTS = 10;
/** Rate limit window in minutes */
const SIGN_IN_WINDOW_MINUTES = 15;

export async function handleSignIn(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return jsonResponse({ error: 'email and password required' }, 400, env);
  }

  const email = body.email.toLowerCase().trim();
  const emailHash = await sha256(email);

  // Rate limit check BEFORE password verification to limit brute-force
  const recentAttempts = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE email_hash = ? AND attempted_at > datetime('now', ? || ' minutes')`,
  )
    .bind(emailHash, `-${SIGN_IN_WINDOW_MINUTES}`)
    .first<{ count: number }>();

  if (recentAttempts && recentAttempts.count >= SIGN_IN_MAX_ATTEMPTS) {
    return jsonResponse({ error: 'too many login attempts, try again later' }, 429, env);
  }

  const user = await env.DB.prepare(
    'SELECT id, password_hash, display_name, avatar_url, custom_avatar_url, avatar_frame FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{
      id: string;
      password_hash: string;
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
    }>();

  if (!user || !user.password_hash) {
    await recordFailedLogin(env, emailHash);
    return jsonResponse({ error: 'invalid credentials' }, 401, env);
  }

  const result = await verifyPassword(body.password, user.password_hash);
  if (!result.valid) {
    await recordFailedLogin(env, emailHash);
    return jsonResponse({ error: 'invalid credentials' }, 401, env);
  }

  // Successful login — clear failed attempts for this email
  await env.DB.prepare('DELETE FROM login_attempts WHERE email_hash = ?').bind(emailHash).run();

  // Lazy migration: bcrypt → PBKDF2 rehash on first successful login
  if (result.needsRehash && result.newHash) {
    await env.DB.prepare(
      `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.newHash, user.id)
      .run();
    console.log(`Rehashed password for user ${user.id} (bcrypt → PBKDF2)`);
  }

  const token = await signToken(user.id, env, { email });

  return jsonResponse(
    {
      access_token: token,
      user: {
        id: user.id,
        email,
        is_anonymous: false,
        user_metadata: {
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          custom_avatar_url: user.custom_avatar_url,
          avatar_frame: user.avatar_frame,
        },
      },
    },
    200,
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/user — 获取当前用户信息（通过 JWT）
// ─────────────────────────────────────────────────────────────────────────────
export async function handleGetUser(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return jsonResponse({ data: { user: null } }, 200, env);
  }

  const payload = await verifyToken(token, env);
  if (!payload) {
    return jsonResponse({ data: { user: null } }, 200, env);
  }

  const user = await env.DB.prepare(
    `SELECT id, email, display_name, avatar_url, custom_avatar_url, avatar_frame, is_anonymous
     FROM users WHERE id = ?`,
  )
    .bind(payload.sub)
    .first<{
      id: string;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
      is_anonymous: number;
    }>();

  if (!user) {
    return jsonResponse({ data: { user: null } }, 200, env);
  }

  return jsonResponse(
    {
      data: {
        user: {
          id: user.id,
          email: user.email,
          is_anonymous: user.is_anonymous === 1,
          user_metadata: {
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            custom_avatar_url: user.custom_avatar_url,
            avatar_frame: user.avatar_frame,
          },
        },
      },
    },
    200,
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /auth/profile — 更新用户资料
// ─────────────────────────────────────────────────────────────────────────────
export async function handleUpdateProfile(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }
  const payload = await verifyToken(token, env);
  if (!payload) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }

  const body = (await request.json()) as {
    displayName?: string;
    avatarUrl?: string;
    customAvatarUrl?: string;
    avatarFrame?: string;
  };

  // Build dynamic SET clause for only provided fields
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.displayName !== undefined) {
    sets.push('display_name = ?');
    values.push(body.displayName);
  }
  if (body.avatarUrl !== undefined) {
    sets.push('avatar_url = ?');
    values.push(body.avatarUrl);
  }
  if (body.customAvatarUrl !== undefined) {
    sets.push('custom_avatar_url = ?');
    values.push(body.customAvatarUrl);
  }
  if (body.avatarFrame !== undefined) {
    sets.push('avatar_frame = ?');
    values.push(body.avatarFrame);
  }

  if (sets.length === 0) {
    return jsonResponse({ success: true }, 200, env);
  }

  sets.push("updated_at = datetime('now')");
  values.push(payload.sub);

  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return jsonResponse({ success: true }, 200, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /auth/password — 修改密码（已登录用户）
// ─────────────────────────────────────────────────────────────────────────────
export async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }
  const payload = await verifyToken(token, env);
  if (!payload) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }

  const body = (await request.json()) as {
    oldPassword?: string;
    newPassword?: string;
  };

  if (!body.oldPassword || !body.newPassword) {
    return jsonResponse({ error: 'oldPassword and newPassword required' }, 400, env);
  }

  if (body.newPassword.length < 6) {
    return jsonResponse({ error: 'password must be at least 6 characters' }, 400, env);
  }

  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(payload.sub)
    .first<{ password_hash: string | null }>();

  if (!user || !user.password_hash) {
    return jsonResponse({ error: 'account has no password (anonymous user)' }, 400, env);
  }

  const result = await verifyPassword(body.oldPassword, user.password_hash);
  if (!result.valid) {
    return jsonResponse({ error: 'invalid old password' }, 401, env);
  }

  const newHash = await hashPassword(body.newPassword);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(newHash, payload.sub)
    .run();

  return jsonResponse({ success: true }, 200, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/signout — 登出（JWT 是无状态的，客户端清除 token 即可）
// ─────────────────────────────────────────────────────────────────────────────
export async function handleSignOut(_request: Request, env: Env): Promise<Response> {
  // JWT is stateless — signout is client-side token removal.
  // Server acknowledges; any future request with old token still validates until expiry.
  return jsonResponse({ success: true }, 200, env);
}

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
  await env.DB.prepare('INSERT INTO login_attempts (email_hash) VALUES (?)').bind(emailHash).run();
}

/** Fetch the stored token_hash for a given token id (used after attempt-count check). */
async function getTokenHash(tokenId: string, env: Env): Promise<string | null> {
  const row = await env.DB.prepare('SELECT token_hash FROM password_reset_tokens WHERE id = ?')
    .bind(tokenId)
    .first<{ token_hash: string }>();
  return row?.token_hash ?? null;
}

export async function handleForgotPassword(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { email?: string };

  if (!body.email) {
    return jsonResponse({ error: 'email required' }, 400, env);
  }

  const email = body.email.toLowerCase().trim();

  // Rate limit BEFORE user lookup to avoid email enumeration via 429 vs 200.
  const recentCount = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM password_reset_tokens t
     JOIN users u ON t.user_id = u.id
     WHERE u.email = ? AND t.created_at > datetime('now', '-1 hour')`,
  )
    .bind(email)
    .first<{ count: number }>();

  if (recentCount && recentCount.count >= RESET_RATE_LIMIT) {
    // Return 200 (not 429) so attackers cannot distinguish registered vs unregistered
    return jsonResponse({ success: true }, 200, env);
  }

  // Check user exists (non-anonymous with password)
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND is_anonymous = 0 AND password_hash IS NOT NULL',
  )
    .bind(email)
    .first<{ id: string }>();

  if (!user) {
    // Don't reveal whether email exists — return success either way
    return jsonResponse({ success: true }, 200, env);
  }

  // Invalidate any previous unused tokens for this user
  await env.DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0`)
    .bind(user.id)
    .run();

  // Generate 6-digit code (CSPRNG) and store hashed
  const randomBuf = new Uint32Array(1);
  crypto.getRandomValues(randomBuf);
  const code = String(100000 + (randomBuf[0] % 900000));
  const tokenHash = await sha256(code + email);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(user.id, tokenHash, expiresAt)
    .run();

  // Send email (fire-and-forget resilience: if email fails, user can retry)
  try {
    await sendPasswordResetEmail(env, email, code);
  } catch (error) {
    console.error('Failed to send reset email:', error);
    return jsonResponse({ error: 'failed to send email, try again later' }, 500, env);
  }

  return jsonResponse({ success: true }, 200, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password — 验证码重置密码 + 自动登录
// ─────────────────────────────────────────────────────────────────────────────
export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    email?: string;
    code?: string;
    newPassword?: string;
  };

  if (!body.email || !body.code || !body.newPassword) {
    return jsonResponse({ error: 'email, code and newPassword required' }, 400, env);
  }

  if (body.newPassword.length < 6) {
    return jsonResponse({ error: 'password must be at least 6 characters' }, 400, env);
  }

  const email = body.email.toLowerCase().trim();
  const tokenHash = await sha256(body.code + email);

  // Find valid token (also check verify_attempts limit)
  const token = await env.DB.prepare(
    `SELECT t.id, t.user_id, t.verify_attempts FROM password_reset_tokens t
     JOIN users u ON t.user_id = u.id
     WHERE u.email = ? AND t.used = 0
       AND t.expires_at > datetime('now')
     ORDER BY t.created_at DESC LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; user_id: string; verify_attempts: number }>();

  if (!token || token.verify_attempts >= RESET_VERIFY_ATTEMPT_LIMIT) {
    return jsonResponse({ error: 'invalid or expired code' }, 400, env);
  }

  // Increment verify attempts before checking hash to prevent brute force
  await env.DB.prepare(
    `UPDATE password_reset_tokens SET verify_attempts = verify_attempts + 1 WHERE id = ?`,
  )
    .bind(token.id)
    .run();

  // Invalidate token if attempt limit now reached
  if (token.verify_attempts + 1 >= RESET_VERIFY_ATTEMPT_LIMIT) {
    await env.DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`)
      .bind(token.id)
      .run();
  }

  // Verify hash
  if (tokenHash !== (await getTokenHash(token.id, env))) {
    return jsonResponse({ error: 'invalid or expired code' }, 400, env);
  }

  // Mark token as used
  await env.DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`)
    .bind(token.id)
    .run();

  // Update password
  const newHash = await hashPassword(body.newPassword);
  await env.DB.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(newHash, token.user_id)
    .run();

  // Auto-login: return JWT
  const jwt = await signToken(token.user_id, env, { email });

  // Fetch user metadata for response
  const user = await env.DB.prepare(
    `SELECT display_name, avatar_url, custom_avatar_url, avatar_frame FROM users WHERE id = ?`,
  )
    .bind(token.user_id)
    .first<{
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
    }>();

  return jsonResponse(
    {
      success: true,
      access_token: jwt,
      user: {
        id: token.user_id,
        email,
        is_anonymous: false,
        user_metadata: {
          display_name: user?.display_name,
          avatar_url: user?.avatar_url,
          custom_avatar_url: user?.custom_avatar_url,
          avatar_frame: user?.avatar_frame,
        },
      },
    },
    200,
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/wechat — 微信小程序登录（wx.login code → openid → JWT）
// ─────────────────────────────────────────────────────────────────────────────

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

export async function handleWechatSignIn(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { code?: string };

  if (!body.code) {
    return jsonResponse({ error: 'code required' }, 400, env);
  }

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return jsonResponse({ error: 'WeChat login not configured' }, 500, env);
  }

  // Exchange code for openid via WeChat code2Session API
  const wxUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  wxUrl.searchParams.set('appid', env.WECHAT_APP_ID);
  wxUrl.searchParams.set('secret', env.WECHAT_APP_SECRET);
  wxUrl.searchParams.set('js_code', body.code);
  wxUrl.searchParams.set('grant_type', 'authorization_code');

  const wxResp = await fetch(wxUrl.toString());
  const wxData: WechatCode2SessionResponse = await wxResp.json();

  if (!wxData.openid) {
    const errMsg = wxData.errmsg || 'code2Session failed';
    return jsonResponse({ error: errMsg, errcode: wxData.errcode }, 401, env);
  }

  const openid = wxData.openid;

  // Look up existing user by wechat_openid
  const existing = await env.DB.prepare(
    `SELECT id, email, display_name, avatar_url, custom_avatar_url, avatar_frame
     FROM users WHERE wechat_openid = ?`,
  )
    .bind(openid)
    .first<{
      id: string;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
    }>();

  if (existing) {
    // Return existing user
    const token = await signToken(existing.id, env, {
      email: existing.email ?? undefined,
    });

    return jsonResponse(
      {
        access_token: token,
        user: {
          id: existing.id,
          email: existing.email,
          is_anonymous: false,
          user_metadata: {
            display_name: existing.display_name,
            avatar_url: existing.avatar_url,
            custom_avatar_url: existing.custom_avatar_url,
            avatar_frame: existing.avatar_frame,
          },
        },
      },
      200,
      env,
    );
  }

  // Create new user with wechat_openid
  const userId = crypto.randomUUID();

  await env.DB.prepare(`INSERT INTO users (id, wechat_openid, is_anonymous) VALUES (?, ?, 0)`)
    .bind(userId, openid)
    .run();

  const token = await signToken(userId, env);

  return jsonResponse(
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
    env,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/bind-wechat — 已登录用户绑定微信（邮箱账号 + wxcode → 绑定 openid）
// ─────────────────────────────────────────────────────────────────────────────
export async function handleBindWechat(request: Request, env: Env): Promise<Response> {
  const bearerToken = extractBearerToken(request);
  if (!bearerToken) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }
  const payload = await verifyToken(bearerToken, env);
  if (!payload) {
    return jsonResponse({ error: 'unauthorized' }, 401, env);
  }

  const body = (await request.json()) as { code?: string };
  if (!body.code) {
    return jsonResponse({ error: 'code required' }, 400, env);
  }

  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    return jsonResponse({ error: 'WeChat login not configured' }, 500, env);
  }

  // Exchange code for openid
  const wxUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  wxUrl.searchParams.set('appid', env.WECHAT_APP_ID);
  wxUrl.searchParams.set('secret', env.WECHAT_APP_SECRET);
  wxUrl.searchParams.set('js_code', body.code);
  wxUrl.searchParams.set('grant_type', 'authorization_code');

  const wxResp = await fetch(wxUrl.toString());
  const wxData: WechatCode2SessionResponse = await wxResp.json();

  if (!wxData.openid) {
    const errMsg = wxData.errmsg || 'code2Session failed';
    return jsonResponse({ error: errMsg, errcode: wxData.errcode }, 401, env);
  }

  const openid = wxData.openid;

  // Check if openid is already bound to another user
  const existingWxUser = await env.DB.prepare('SELECT id FROM users WHERE wechat_openid = ?')
    .bind(openid)
    .first<{ id: string }>();

  if (existingWxUser) {
    if (existingWxUser.id === payload.sub) {
      // Already bound to same user — no-op
      return jsonResponse({ success: true }, 200, env);
    }
    // Bound to a different user — check if it's a temporary WeChat-only account
    const wxUser = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
      .bind(existingWxUser.id)
      .first<{ id: string; email: string | null; password_hash: string | null }>();

    if (wxUser && !wxUser.email && !wxUser.password_hash) {
      // Temporary WeChat account (no email, no password) — safe to delete and rebind
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(wxUser.id).run();
    } else {
      return jsonResponse({ error: 'wechat_already_bound' }, 409, env);
    }
  }

  // Bind openid to current user
  await env.DB.prepare(
    `UPDATE users SET wechat_openid = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(openid, payload.sub)
    .run();

  return jsonResponse({ success: true }, 200, env);
}
