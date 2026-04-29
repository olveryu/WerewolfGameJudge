/**
 * JWT Auth — 自实现 JWT 认证 + Refresh Token
 *
 * Access token: 短期（1 小时），HS256 签名，含 sub/ver/anon/email。
 * Refresh token: 随机 hex 字符串，SHA-256 哈希后存 D1，90 天有效，单次使用（rotation）。
 * Token version: users.token_version 字段，signout/password change 时 +1 使所有旧 token 失效。
 */

import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { jwtVerify, SignJWT } from 'jose';

import { createDb } from '../db';
import { refreshTokens, users } from '../db/schema';
import type { Env } from '../env';

/** JWT payload 中包含的用户信息 */
interface JwtPayload {
  /** User ID */
  sub: string;
  /** Token version — must match users.token_version */
  ver: number;
  /** Is anonymous user */
  anon?: boolean;
  /** Email (if authenticated) */
  email?: string;
  /** Issued at (seconds) */
  iat: number;
  /** Expiration (seconds) */
  exp: number;
}

const JWT_ALGORITHM = 'HS256' as const;
/** Access token expiry: 1 hour */
const ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 60;
/** Refresh token expiry: 90 days */
const REFRESH_TOKEN_EXPIRY_DAYS = 90;

function getSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/** SHA-256 hex hash */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 签发 access token（短期 JWT） */
async function signToken(
  userId: string,
  env: Env,
  claims?: { anon?: boolean; email?: string; ver?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: userId,
    ver: claims?.ver ?? 0,
    anon: claims?.anon,
    email: claims?.email,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .sign(getSecret(env));
}

/** 验证 JWT，返回 payload 或 null */
export async function verifyToken(token: string, env: Env): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** 从 Authorization header 提取 Bearer token */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ── Refresh Token 管理 ──────────────────────────────────────────────────────

/** 生成 refresh token（随机 hex），存哈希到 D1，返回明文 */
async function createRefreshToken(userId: string, env: Env): Promise<string> {
  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const rawToken = Array.from(rawBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const db = createDb(env.DB);
  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return rawToken;
}

/**
 * 验证 refresh token 并执行 rotation。
 * 成功：删除旧 token，签发新 access + refresh token 对。
 * 失败：返回 null。
 */
export async function rotateRefreshToken(
  rawToken: string,
  env: Env,
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const tokenHash = await sha256Hex(rawToken);
  const db = createDb(env.DB);

  // Find token by hash
  const row = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .get();

  if (!row) return null;

  // Check expiry
  if (new Date(row.expiresAt) < new Date()) {
    // Expired — delete and reject
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    return null;
  }

  // Delete used token (rotation: one-time use)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));

  // Load user to get tokenVersion and claims
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      isAnonymous: users.isAnonymous,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .get();

  if (!user) return null;

  // Issue new token pair
  const accessToken = await signToken(user.id, env, {
    anon: user.isAnonymous === 1 ? true : undefined,
    email: user.email ?? undefined,
    ver: user.tokenVersion,
  });
  const newRefreshToken = await createRefreshToken(user.id, env);

  return { accessToken, refreshToken: newRefreshToken, userId: user.id };
}

/** Revoke all refresh tokens for a user (used on signout, password change) */
export async function revokeAllRefreshTokens(userId: string, env: Env): Promise<void> {
  const db = createDb(env.DB);
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

/** Increment token_version for a user, invalidating all existing access tokens */
export async function bumpTokenVersion(userId: string, env: Env): Promise<number> {
  const db = createDb(env.DB);
  await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  const row = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return row!.tokenVersion;
}

// ── Token Pair 签发（login/signup/reset 统一入口）───────────────────────────

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

/** 签发 access + refresh token 对 */
export async function issueTokenPair(
  userId: string,
  env: Env,
  claims?: { anon?: boolean; email?: string; ver?: number },
): Promise<TokenPair> {
  const accessToken = await signToken(userId, env, claims);
  const refreshToken = await createRefreshToken(userId, env);
  return { access_token: accessToken, refresh_token: refreshToken };
}

// ── Hono 中间件 ─────────────────────────────────────────────────────────────

/** requireAuth 中间件设置的 Variables 类型 */
type AuthVariables = {
  userId: string;
  jwtPayload: JwtPayload;
};

/**
 * Hono 中间件：要求 Bearer token 认证。
 * 验证 JWT 签名 + token_version（防止 revoked token 访问）。
 * 通过后 c.var.userId / c.var.jwtPayload 可用。
 */
export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);
  const token = auth.slice(7);
  const payload = await verifyToken(token, c.env);
  if (!payload) return c.json({ error: 'unauthorized' }, 401);

  // Verify token version matches DB (revocation check)
  const db = createDb(c.env.DB);
  const user = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (!user || user.tokenVersion !== payload.ver) {
    return c.json({ error: 'token_revoked' }, 401);
  }

  c.set('userId', payload.sub);
  c.set('jwtPayload', payload);
  await next();
});
