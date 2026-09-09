/** Cloudflare cron composition for owner-local maintenance tasks. */

import type { Env } from '../env';
import { cleanupAnonymousUsers } from '../features/account/maintenance';
import {
  cleanupExpiredRefreshTokenFamilies,
  cleanupExpiredWechatClaims,
  cleanupOldLoginAttempts,
} from '../features/auth/maintenance';
import { cleanupExpiredIdempotencyKeys } from '../features/gacha/maintenance';
import { cleanupFibWordAudit } from '../games/fibking/maintenance';
import { createLogger } from '../platform/observability/logger';
import { expireStaleRooms, reconcileRooms } from '../platform/room/maintenance';
import { measureDatabaseCapacity } from '../platform/storage/capacity';

const log = createLogger('scheduled');

const ROOM_RECONCILIATION_CRON = '*/5 * * * *';
const DAILY_CLEANUP_CRON = '0 3 * * *';
const FIB_WORD_SUPPLY_CRON = '0 4 * * *';

/** Run daily retention tasks after marking stale rooms for saga deletion. */
async function runDailyCleanup(env: Env, nowMs: number): Promise<void> {
  const tasks = [
    { name: 'room expiry', run: () => expireStaleRooms(env, nowMs) },
    { name: 'room reconciliation', run: () => reconcileRooms(env, nowMs) },
    { name: 'anonymous user cleanup', run: () => cleanupAnonymousUsers(env) },
    { name: 'Fib audit cleanup', run: () => cleanupFibWordAudit(env.DB, nowMs) },
    { name: 'database capacity', run: () => measureDatabaseCapacity(env.DB) },
    { name: 'login attempt cleanup', run: () => cleanupOldLoginAttempts(env) },
    {
      name: 'refresh-token family cleanup',
      run: () => cleanupExpiredRefreshTokenFamilies(env, nowMs),
    },
    { name: 'idempotency cleanup', run: () => cleanupExpiredIdempotencyKeys(env) },
    { name: 'WeChat claim cleanup', run: () => cleanupExpiredWechatClaims(env) },
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
      await reconcileRooms(env, nowMs);
      await measureDatabaseCapacity(env.DB);
      return;
    case DAILY_CLEANUP_CRON:
      await runDailyCleanup(env, nowMs);
      return;
    case FIB_WORD_SUPPLY_CRON:
      if (env.FIB_WORD_SUPPLY_ENABLED === 'true') {
        const day = new Date(nowMs).toISOString().slice(0, 10);
        await env.FIB_WORD_SUPPLY.createBatch([{ id: `fib-${day}`, params: { day } }]);
      }
      return;
    default:
      throw new Error(`Unknown cron trigger: ${cron}`);
  }
}
