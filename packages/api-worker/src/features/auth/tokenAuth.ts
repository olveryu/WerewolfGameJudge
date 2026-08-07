/**
 * JWT Auth — custom JWT authentication + Refresh Token
 *
 * Access token: short-lived (1 hour), HS256 signed, contains stable sub/ver claims.
 * Refresh token: opaque 256-bit value, SHA-256 hashed in D1, rolling 90-day TTL, family rotation.
 * Token version: users.token_version field, bumped on signout/password change to invalidate all old tokens.
 */

import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { createDb } from '../../db';
import type { AppEnv, Env } from '../../env';
import { users } from '../account/dbSchema';
import { refreshTokenRotations, refreshTokens } from './dbSchema';

const JWT_ALGORITHM = 'HS256' as const;
/** Access token expiry: 1 hour */
const ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 60;
/** Refresh token expiry: 90 days */
const REFRESH_TOKEN_EXPIRY_DAYS = 90;
/** Direct predecessor retry window for a response lost after successful rotation. */
const REFRESH_TOKEN_REPLAY_WINDOW_MS = 60_000;

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

function getSecret(env: Env): Uint8Array<ArrayBuffer> {
  const encodedSecret = new TextEncoder().encode(env.JWT_SECRET);
  const secret = new Uint8Array(new ArrayBuffer(encodedSecret.byteLength));
  secret.set(encodedSecret);
  return secret;
}

/** SHA-256 hex hash */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Derive one opaque successor without persisting refresh-token plaintext. */
async function deriveRotatedRefreshToken(rawToken: string, env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    getSecret(env),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`refresh-token-rotation:${rawToken}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
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

export type RefreshTokenRotationResult =
  | {
      readonly kind: 'rotated' | 'replayed';
      readonly accessToken: string;
      readonly refreshToken: string;
      readonly userId: string;
    }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'reuseDetected'; readonly userId: string };

async function signRefreshAccessToken(userId: string, env: Env): Promise<string> {
  const db = createDb(env.DB);
  const user = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (user === undefined) throw new Error(`Expected refresh-token user ${userId}`);
  return signToken(userId, env, user.tokenVersion);
}

async function replayRotatedRefreshToken(
  rawToken: string,
  tokenHash: string,
  env: Env,
  nowMs: number,
): Promise<RefreshTokenRotationResult> {
  const db = createDb(env.DB);
  const rotation = await db
    .select({
      refreshTokenId: refreshTokenRotations.refreshTokenId,
      successorTokenHash: refreshTokenRotations.successorTokenHash,
      rotatedAt: refreshTokenRotations.rotatedAt,
      currentTokenHash: refreshTokens.tokenHash,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokenRotations)
    .innerJoin(refreshTokens, eq(refreshTokenRotations.refreshTokenId, refreshTokens.id))
    .where(eq(refreshTokenRotations.tokenHash, tokenHash))
    .get();

  if (rotation === undefined || new Date(rotation.expiresAt).getTime() <= nowMs) {
    return { kind: 'invalid' };
  }

  const isDirectPredecessor = rotation.successorTokenHash === rotation.currentTokenHash;
  const isInsideReplayWindow =
    nowMs - new Date(rotation.rotatedAt).getTime() <= REFRESH_TOKEN_REPLAY_WINDOW_MS;
  if (!isDirectPredecessor || !isInsideReplayWindow) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, rotation.refreshTokenId));
    return { kind: 'reuseDetected', userId: rotation.userId };
  }

  const successorToken = await deriveRotatedRefreshToken(rawToken, env);
  const successorTokenHash = await sha256Hex(successorToken);
  if (successorTokenHash !== rotation.successorTokenHash) {
    throw new Error('Refresh-token rotation history does not match its derived successor');
  }

  return {
    kind: 'replayed',
    accessToken: await signRefreshAccessToken(rotation.userId, env),
    refreshToken: successorToken,
    userId: rotation.userId,
  };
}

/**
 * Verify a refresh token and advance its rotation family.
 *
 * @remarks D1 batch records the consumed-token relationship and advances the current token
 *   atomically. A direct predecessor can replay the same derived successor for 60 seconds;
 *   older or late reuse revokes only that token family.
 */
export async function rotateRefreshToken(
  rawToken: string,
  env: Env,
): Promise<RefreshTokenRotationResult> {
  const tokenHash = await sha256Hex(rawToken);
  const db = createDb(env.DB);
  const nowMs = Date.now();

  const row = await db
    .select({
      id: refreshTokens.id,
      userId: refreshTokens.userId,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .get();

  if (row === undefined) return replayRotatedRefreshToken(rawToken, tokenHash, env, nowMs);
  if (new Date(row.expiresAt).getTime() <= nowMs) return { kind: 'invalid' };

  const successorToken = await deriveRotatedRefreshToken(rawToken, env);
  const successorTokenHash = await sha256Hex(successorToken);
  const rotatedAt = new Date(nowMs).toISOString();
  const successorExpiresAt = new Date(
    nowMs + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const accessToken = await signRefreshAccessToken(row.userId, env);
  const batchResults = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO refresh_token_rotations
         (token_hash, refresh_token_id, successor_token_hash, rotated_at)
       SELECT token_hash, id, ?1, ?2
       FROM refresh_tokens
       WHERE id = ?3 AND token_hash = ?4 AND expires_at > ?2`,
    ).bind(successorTokenHash, rotatedAt, row.id, tokenHash),
    env.DB.prepare(
      `UPDATE refresh_tokens
       SET token_hash = ?1, expires_at = ?2, created_at = ?3
       WHERE id = ?4 AND token_hash = ?5 AND expires_at > ?3`,
    ).bind(successorTokenHash, successorExpiresAt, rotatedAt, row.id, tokenHash),
  ]);
  const historyResult = batchResults[0];
  const tokenResult = batchResults[1];
  if (historyResult === undefined || tokenResult === undefined) {
    throw new Error('Refresh-token rotation batch returned incomplete results');
  }
  if (historyResult.meta.changes === 0 && tokenResult.meta.changes === 0) {
    return replayRotatedRefreshToken(rawToken, tokenHash, env, nowMs);
  }
  if (historyResult.meta.changes !== 1 || tokenResult.meta.changes !== 1) {
    throw new Error('Refresh-token rotation batch violated its atomic update invariant');
  }

  return {
    kind: 'rotated',
    accessToken,
    refreshToken: successorToken,
    userId: row.userId,
  };
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
