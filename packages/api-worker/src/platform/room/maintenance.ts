/** Room-directory maintenance tasks invoked by the application scheduler. */

import type { Env } from '../../env';
import { createLogger } from '../observability/logger';
import { markExpiredRoomsDeleting } from './roomDirectory';
import { reconcileRoomDirectory } from './roomSaga';

const log = createLogger('room-maintenance');
const ROOM_MAX_AGE_HOURS = 24;
const ROOM_EXPIRY_BATCH_LIMIT = 1000;

/** Mark stale rooms for authoritative saga deletion. */
export async function expireStaleRooms(
  env: Env,
  nowMs: number,
  limit: number = ROOM_EXPIRY_BATCH_LIMIT,
): Promise<{ marked: number }> {
  const cutoffMs = nowMs - ROOM_MAX_AGE_HOURS * 60 * 60 * 1_000;
  const marked = await markExpiredRoomsDeleting(env, cutoffMs, nowMs, limit);
  log.info('stale room expiry complete', { marked });
  return { marked };
}

/** Recover interrupted room create and delete sagas. Throws on any failure (cron path). */
export async function reconcileRooms(env: Env, nowMs: number): Promise<{ reconciled: number }> {
  const { reconciled, failures } = await reconcileRoomDirectory(env, nowMs);
  log.info('room reconciliation complete', { reconciled, failureCount: failures.length });
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} room saga reconciliation failures`);
  }
  return { reconciled };
}

/** Recover interrupted room sagas without throwing; returns per-room errors (admin diagnostic path). */
export async function reconcileRoomsDetailed(
  env: Env,
  nowMs: number,
): Promise<{ reconciled: number; errors: string[] }> {
  const { reconciled, failures } = await reconcileRoomDirectory(env, nowMs);
  const errors = failures.map((failure) => failure.message);
  log.info('room reconciliation complete', { reconciled, failureCount: errors.length });
  return { reconciled, errors };
}
