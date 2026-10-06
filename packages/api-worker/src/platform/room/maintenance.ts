/** Room-directory maintenance tasks invoked by the application scheduler. */

import type { Env } from '../../env';
import { createLogger } from '../observability/logger';
import { markExpiredRoomsDeleting } from './roomDirectory';
import { reconcileRoomDirectory } from './roomSaga';

const log = createLogger('room-maintenance');
const ROOM_MAX_AGE_HOURS = 24;
const ROOM_EXPIRY_BATCH_LIMIT = 1000;

/** Mark stale rooms for authoritative saga deletion. */
export async function expireStaleRooms(env: Env, nowMs: number): Promise<{ marked: number }> {
  const cutoffMs = nowMs - ROOM_MAX_AGE_HOURS * 60 * 60 * 1_000;
  const marked = await markExpiredRoomsDeleting(env, cutoffMs, nowMs, ROOM_EXPIRY_BATCH_LIMIT);
  log.info('stale room expiry complete', { marked });
  return { marked };
}

/** Recover interrupted room create and delete sagas. */
export async function reconcileRooms(env: Env, nowMs: number): Promise<{ reconciled: number }> {
  const reconciled = await reconcileRoomDirectory(env, nowMs);
  log.info('room reconciliation complete', { reconciled });
  return { reconciled };
}
