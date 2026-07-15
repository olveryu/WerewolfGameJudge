/**
 * JWT Auth — custom JWT authentication + Refresh Token
 *
 * Access token: short-lived (1 hour), HS256 signed, contains stable sub/ver claims.
 * Refresh token: random hex string, SHA-256 hashed and stored in D1, 90-day TTL, single-use (rotation).
 * Token version: users.token_version field, bumped on signout/password change to invalidate all old tokens.
 */

import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { createDb } from '../../db';
import type { AppEnv, Env } from '../../env';
import { users } from '../account/dbSchema';
import { refreshTokens } from './dbSchema';

const JWT_ALGORITHM = 'HS256' as const;
/** Access token expiry: 1 hour */
const ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 60;
/** Refresh token expiry: 90 days */
const REFRESH_TOKEN_EXPIRY_DAYS = 90;

const accessTokenClaimsSchema = z.strictObject({
  sub: z.string().min(1),
  ver: z.int().nonnegative(),
  iat: z.int().nonnegative(),
  exp: z.int().positive(),
});

type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

type AccessTokenAuthentication =
  | {
      readonly kind: 'authenticated';
      readonly principal: {
        readonly userId: string;
        readonly isAnonymous: boolean;
        readonly tokenVersion: number;
      };
    }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'userNotFound' };

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
async function signToken(userId: string, env: Env, tokenVersion: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ver: tokenVersion })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_EXPIRY_SECONDS)
    .sign(getSecret(env));
}

async function verifyAccessTokenClaims(token: string, env: Env): Promise<AccessTokenClaims | null> {
  const secret = getSecret(env);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [JWT_ALGORITHM] });
    const parsed = accessTokenClaimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

/** Verify access-token signature, claims, user existence, and revocation version. */
export async function authenticateAccessToken(
  token: string,
  env: Env,
): Promise<AccessTokenAuthentication> {
  const claims = await verifyAccessTokenClaims(token, env);
  if (claims === null) return { kind: 'invalid' };

  const db = createDb(env.DB);
  const user = await db
    .select({ isAnonymous: users.isAnonymous, tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();

  if (user === undefined) return { kind: 'userNotFound' };
  if (user.tokenVersion !== claims.ver) return { kind: 'revoked' };
  return {
    kind: 'authenticated',
    principal: {
      userId: claims.sub,
      isAnonymous: user.isAnonymous === 1,
      tokenVersion: user.tokenVersion,
    },
  };
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
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .get();

  if (!user) return null;

  // Issue new token pair
  const accessToken = await signToken(user.id, env, user.tokenVersion);
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
  const result = await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  if (result.meta.changes !== 1) {
    throw new Error(
      `Expected one user while bumping token version, changed ${result.meta.changes}`,
    );
  }

  const row = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (row === undefined) {
    throw new Error('User disappeared after token version update');
  }
  return row.tokenVersion;
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
  tokenVersion: number,
): Promise<TokenPair> {
  const accessToken = await signToken(userId, env, tokenVersion);
  const refreshToken = await createRefreshToken(userId, env);
  return { access_token: accessToken, refresh_token: refreshToken };
}

// ── Hono middleware ─────────────────────────────────────────────────────────

/**
 * Hono middleware: requires Bearer token authentication.
 * Verifies JWT signature + token_version (blocks revoked tokens).
 * On success c.var.userId is available.
 *
 * @throws 401 — Bearer token missing/malformed, JWT verification failed (expired/invalid signature),
 *   token_version mismatch (token revoked), or user does not exist
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);
  const token = auth.slice(7);
  const authentication = await authenticateAccessToken(token, c.env);
  if (authentication.kind === 'invalid') return c.json({ error: 'unauthorized' }, 401);
  if (authentication.kind !== 'authenticated') {
    return c.json({ error: 'token_revoked' }, 401);
  }

  c.set('userId', authentication.principal.userId);
  c.set('isAnonymous', authentication.principal.isAnonymous);
  await next();
});
