/** Cloudflare cron composition for owner-local maintenance tasks. */

import type { Env } from '../env';
import { cleanupAnonymousUsers } from '../features/account/maintenance';
import {
  cleanupExpiredRefreshTokenFamilies,
  cleanupExpiredWechatClaims,
  cleanupOldLoginAttempts,
} from '../features/auth/maintenance';
import { cleanupExpiredIdempotencyKeys } from '../features/gacha/maintenance';
import { WORKER_GAME_MAINTENANCE_TASKS } from '../games/catalog';
import { createLogger } from '../platform/observability/logger';
import { expireStaleRooms, reconcileRooms } from '../platform/room/maintenance';
import { measureDatabaseCapacity } from '../platform/storage/capacity';
import {
  isWordSupplyAvailable,
  readAutomaticWordSupply,
} from '../platform/wordSupply/automaticSupply';

const log = createLogger('scheduled');

const ROOM_RECONCILIATION_CRON = '*/5 * * * *';
const DAILY_CLEANUP_CRON = '0 3 * * *';
const FIB_WORD_SUPPLY_CRON = '0 4 * * *';

function getGameMaintenanceTasks(env: Env, cron: string, nowMs: number) {
  return WORKER_GAME_MAINTENANCE_TASKS.filter((task) => task.cron === cron).map((task) => ({
    name: task.name,
    run: () => task.run(env.DB, nowMs),
  }));
}

async function runMaintenanceTasks(
  tasks: readonly { readonly name: string; run(): Promise<unknown> }[],
  scope: string,
): Promise<void> {
  const failures: Error[] = [];
  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      failures.push(cause);
      log.error(`${scope} task failed`, { task: task.name, error: cause.message });
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} ${scope} tasks failed`);
  }
}

/** Run daily retention tasks after marking stale rooms for saga deletion. */
async function runDailyCleanup(env: Env, nowMs: number): Promise<void> {
  const tasks = [
    { name: 'room expiry', run: () => expireStaleRooms(env, nowMs) },
    { name: 'room reconciliation', run: () => reconcileRooms(env, nowMs) },
    { name: 'anonymous user cleanup', run: () => cleanupAnonymousUsers(env) },
    ...getGameMaintenanceTasks(env, DAILY_CLEANUP_CRON, nowMs),
    { name: 'database capacity', run: () => measureDatabaseCapacity(env.DB) },
    { name: 'login attempt cleanup', run: () => cleanupOldLoginAttempts(env) },
    {
      name: 'refresh-token family cleanup',
      run: () => cleanupExpiredRefreshTokenFamilies(env, nowMs),
    },
    { name: 'idempotency cleanup', run: () => cleanupExpiredIdempotencyKeys(env) },
    { name: 'WeChat claim cleanup', run: () => cleanupExpiredWechatClaims(env) },
  ] as const;
  await runMaintenanceTasks(tasks, 'daily cleanup');
  log.info('cleanup complete');
}

/** Dispatch one configured cron expression; unknown schedules are configuration errors. */
export async function runScheduledCron(env: Env, cron: string, nowMs: number): Promise<void> {
  switch (cron) {
    case ROOM_RECONCILIATION_CRON:
      await runMaintenanceTasks(
        [
          { name: 'room reconciliation', run: () => reconcileRooms(env, nowMs) },
          { name: 'database capacity', run: () => measureDatabaseCapacity(env.DB) },
          ...getGameMaintenanceTasks(env, ROOM_RECONCILIATION_CRON, nowMs),
        ],
        'periodic maintenance',
      );
      return;
    case DAILY_CLEANUP_CRON:
      await runDailyCleanup(env, nowMs);
      return;
    case FIB_WORD_SUPPLY_CRON:
      if (
        isWordSupplyAvailable(env, 'fibking') &&
        (await readAutomaticWordSupply(env, 'fibking')).enabled
      ) {
        const day = new Date(nowMs).toISOString().slice(0, 10);
        await env.FIB_WORD_SUPPLY.createBatch([{ id: `fib-${day}`, params: { day } }]);
      }
      if (
        isWordSupplyAvailable(env, 'undercover') &&
        (await readAutomaticWordSupply(env, 'undercover')).enabled
      ) {
        const day = new Date(nowMs).toISOString().slice(0, 10);
        await env.UNDERCOVER_WORD_SUPPLY.createBatch([
          { id: `undercover-${day}`, params: { day } },
        ]);
      }
      if (
        isWordSupplyAvailable(env, 'drawguess') &&
        (await readAutomaticWordSupply(env, 'drawguess')).enabled
      ) {
        const day = new Date(nowMs).toISOString().slice(0, 10);
        await env.DRAWGUESS_WORD_SUPPLY.createBatch([{ id: `drawguess-${day}`, params: { day } }]);
      }
      return;
    default:
      throw new Error(`Unknown cron trigger: ${cron}`);
  }
}
