/**
 * JWT Auth — 自实现轻量级 JWT 认证
 *
 * 使用 jose 库签发和验证 JWT。
 * 覆盖匿名登录和邮箱认证两种场景。
 * 不依赖第三方 auth 服务。
 */

import { jwtVerify, SignJWT } from 'jose';

import type { Env } from '../env';

/** JWT payload 中包含的用户信息 */
interface JwtPayload {
  /** User ID */
  sub: string;
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
/** Token expiry: 30 days (matches Supabase default session) */
const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

function getSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/** 签发 JWT */
export async function signToken(
  userId: string,
  env: Env,
  claims?: { anon?: boolean; email?: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: userId,
    anon: claims?.anon,
    email: claims?.email,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
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
