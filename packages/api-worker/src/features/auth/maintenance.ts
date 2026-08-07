/** Authentication retention tasks invoked by the application scheduler. */

import { lte, sql } from 'drizzle-orm';

import { createDb } from '../../db';
import type { Env } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { loginAttempts, refreshTokens, wxClaims } from './dbSchema';

const log = createLogger('auth-maintenance');
const WECHAT_CLAIM_MAX_AGE_MINUTES = 5;

/** Delete login attempts outside the rate-limit window. */
export async function cleanupOldLoginAttempts(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(loginAttempts)
    .where(sql`${loginAttempts.attemptedAt} < datetime('now', '-1 hour')`)
    .returning({ id: loginAttempts.id });

  const deleted = result.length;
  log.info('login attempt cleanup complete', { deleted });
  return { deleted };
}

/** Delete expired refresh-token families and their cascaded rotation lineage. */
export async function cleanupExpiredRefreshTokenFamilies(
  env: Env,
  nowMs: number,
): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(refreshTokens)
    .where(lte(refreshTokens.expiresAt, new Date(nowMs).toISOString()))
    .returning({ id: refreshTokens.id });

  const deleted = result.length;
  log.info('expired refresh-token family cleanup complete', { deleted });
  return { deleted };
}

/** Delete expired single-use WeChat claims. */
export async function cleanupExpiredWechatClaims(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(wxClaims)
    .where(
      sql`${wxClaims.createdAt} < datetime('now', ${`-${WECHAT_CLAIM_MAX_AGE_MINUTES}`} || ' minutes')`,
    )
    .returning({ nonce: wxClaims.nonce });

  const deleted = result.length;
  log.info('WeChat claim cleanup complete', { deleted });
  return { deleted };
}
