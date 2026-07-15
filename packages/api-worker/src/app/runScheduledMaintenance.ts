/**
 * Cron Handlers — scheduled cleanup tasks
 *
 * Triggered by Cloudflare Cron Triggers.
 * - Reconciles interrupted room create/delete sagas every five minutes
 * - Marks rooms created over 24 hours ago for authoritative deletion at UTC 03:00
 * - Cleans up anonymous users inactive for 14 days (must not be host of any room)
 */

import { sql } from 'drizzle-orm';

import { createDb } from '../db';
import { idempotencyKeys, loginAttempts, users, wxClaims } from '../db/applicationSchema';
import type { Env } from '../env';
import { createLogger } from '../platform/observability/logger';
import { markExpiredRoomsDeleting } from '../platform/room/roomDirectory';
import { reconcileRoomDirectory } from '../platform/room/roomSaga';

const log = createLogger('cron');

const ROOM_MAX_AGE_HOURS = 24;
const ANON_INACTIVE_DAYS = 14;
const BATCH_LIMIT = 1000;

const ROOM_RECONCILIATION_CRON = '*/5 * * * *';
const DAILY_CLEANUP_CRON = '0 3 * * *';

async function expireStaleRooms(env: Env, nowMs: number): Promise<{ marked: number }> {
  const cutoffMs = nowMs - ROOM_MAX_AGE_HOURS * 60 * 60 * 1_000;
  const marked = await markExpiredRoomsDeleting(env, cutoffMs, nowMs, BATCH_LIMIT);
  log.info('expireStaleRooms', { marked });
  return { marked };
}

async function cleanupAnonymousUsers(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(users)
    .where(
      sql`${users.id} IN (
        SELECT u.id FROM users u
        LEFT JOIN rooms r ON r.host_user_id = u.id
        WHERE u.is_anonymous = 1
          AND u.updated_at < datetime('now', ${`-${ANON_INACTIVE_DAYS}`} || ' days')
          AND r.id IS NULL
        LIMIT ${BATCH_LIMIT}
      )`,
    )
    .returning({ id: users.id });

  const deleted = result.length;
  log.info('cleanupAnonymousUsers', { deleted });
  return { deleted };
}

async function cleanupOldLoginAttempts(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(loginAttempts)
    .where(sql`${loginAttempts.attemptedAt} < datetime('now', '-1 hour')`)
    .returning({ id: loginAttempts.id });

  const deleted = result.length;
  log.info('cleanupOldLoginAttempts', { deleted });
  return { deleted };
}

const IDEMPOTENCY_KEY_MAX_AGE_HOURS = 24;

async function cleanupExpiredIdempotencyKeys(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(idempotencyKeys)
    .where(
      sql`${idempotencyKeys.createdAt} < datetime('now', ${`-${IDEMPOTENCY_KEY_MAX_AGE_HOURS}`} || ' hours')`,
    )
    .returning({ key: idempotencyKeys.key });

  const deleted = result.length;
  log.info('cleanupExpiredIdempotencyKeys', { deleted });
  return { deleted };
}

const WX_CLAIM_MAX_AGE_MINUTES = 5;

async function cleanupExpiredWxClaims(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(wxClaims)
    .where(
      sql`${wxClaims.createdAt} < datetime('now', ${`-${WX_CLAIM_MAX_AGE_MINUTES}`} || ' minutes')`,
    )
    .returning({ nonce: wxClaims.nonce });

  const deleted = result.length;
  if (deleted > 0) log.info('cleanupExpiredWxClaims', { deleted });
  return { deleted };
}

/** Run room saga recovery independently from daily data retention. */
async function runRoomReconciliation(env: Env, nowMs: number): Promise<void> {
  const reconciled = await reconcileRoomDirectory(env, nowMs);
  log.info('room reconciliation complete', { reconciled });
}

/** Run daily retention tasks after marking stale rooms for saga deletion. */
async function runDailyCleanup(env: Env, nowMs: number): Promise<void> {
  const tasks = [
    { name: 'room expiry', run: () => expireStaleRooms(env, nowMs) },
    { name: 'room reconciliation', run: () => runRoomReconciliation(env, nowMs) },
    { name: 'anonymous user cleanup', run: () => cleanupAnonymousUsers(env) },
    { name: 'login attempt cleanup', run: () => cleanupOldLoginAttempts(env) },
    { name: 'idempotency cleanup', run: () => cleanupExpiredIdempotencyKeys(env) },
    { name: 'WeChat claim cleanup', run: () => cleanupExpiredWxClaims(env) },
  ] as const;
  const failures: Error[] = [];

  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      failures.push(cause);
      log.error('daily cleanup task failed', { task: task.name, error: cause.message });
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} daily cleanup tasks failed`);
  }
  log.info('cleanup complete');
}

/** Dispatch one configured cron expression; unknown schedules are configuration errors. */
export async function runScheduledCron(env: Env, cron: string, nowMs: number): Promise<void> {
  switch (cron) {
    case ROOM_RECONCILIATION_CRON:
      await runRoomReconciliation(env, nowMs);
      return;
    case DAILY_CLEANUP_CRON:
      await runDailyCleanup(env, nowMs);
      return;
    default:
      throw new Error(`Unknown cron trigger: ${cron}`);
  }
}
