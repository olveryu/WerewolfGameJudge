/**
 * JWT Auth — custom JWT authentication + Refresh Token
 *
 * Access token: short-lived (1 hour), HS256 signed, contains sub/ver/anon/email.
 * Refresh token: random hex string, SHA-256 hashed and stored in D1, 90-day TTL, single-use (rotation).
 * Token version: users.token_version field, bumped on signout/password change to invalidate all old tokens.
 */

import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { jwtVerify, SignJWT } from 'jose';

import { createDb } from '../db';
import { refreshTokens, users } from '../db/schema';
import type { Env } from '../env';

/** User info contained in JWT payload */
interface JwtPayload {
  /** User UUID (users.id) */
  sub: string;
  /** Token version — must match users.token_version; mismatch = token revoked */
  ver: number;
  /** true = anonymous user; undefined = authenticated user */
  anon?: boolean;
  /** Set only for authenticated users */
  email?: string;
  /** Issued at (Unix seconds, not milliseconds) */
  iat: number;
  /** Expiration (Unix seconds, not milliseconds) */
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

/** Issue an access token (short-lived JWT) */
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

/** Verify JWT, return payload or null */
export async function verifyToken(token: string, env: Env): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Extract Bearer token from Authorization header */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ── Refresh Token management ──────────────────────────────────────────────

/** Generate refresh token (random hex), store hash in D1, return plaintext */
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
 * Verify refresh token and perform rotation.
 * Success: delete old token, issue new access + refresh token pair.
 * Failure: return null.
 *
 * @remarks Uses atomic DELETE-RETURNING: among concurrent requests only one gets the token,
 *   the rest get null. No race condition — single-use is guaranteed by SQL DELETE atomicity.
 */
export async function rotateRefreshToken(
  rawToken: string,
  env: Env,
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  const tokenHash = await sha256Hex(rawToken);
  const db = createDb(env.DB);

  // Read token data first (D1 does not support DELETE...RETURNING via .get())
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

  // Reject if expired before consuming the token
  if (new Date(row.expiresAt) < new Date()) return null;

  // Atomic delete — meta.changes === 0 means a concurrent request already consumed it
  const deleteResult = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .run();

  if (deleteResult.meta.changes === 0) return null;

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

// ── Token Pair issuance (unified entry for login/signup/reset) ─────────────

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

/** Issue access + refresh token pair */
export async function issueTokenPair(
  userId: string,
  env: Env,
  claims?: { anon?: boolean; email?: string; ver?: number },
): Promise<TokenPair> {
  const accessToken = await signToken(userId, env, claims);
  const refreshToken = await createRefreshToken(userId, env);
  return { access_token: accessToken, refresh_token: refreshToken };
}

// ── Hono middleware ─────────────────────────────────────────────────────────

/** Variables type set by the requireAuth middleware */
type AuthVariables = {
  userId: string;
  jwtPayload: JwtPayload;
};

/**
 * Hono middleware: requires Bearer token authentication.
 * Verifies JWT signature + token_version (blocks revoked tokens).
 * On success c.var.userId / c.var.jwtPayload are available.
 *
 * @throws 401 — Bearer token missing/malformed, JWT verification failed (expired/invalid signature),
 *   token_version mismatch (token revoked), or user does not exist
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
