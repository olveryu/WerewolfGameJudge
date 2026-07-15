/** Gacha retention tasks invoked by the application scheduler. */

import { sql } from 'drizzle-orm';

import { createDb } from '../../db';
import type { Env } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { idempotencyKeys } from './dbSchema';

const log = createLogger('gacha-maintenance');
const IDEMPOTENCY_KEY_MAX_AGE_HOURS = 24;

/** Delete expired mutation replay records. */
export async function cleanupExpiredIdempotencyKeys(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(idempotencyKeys)
    .where(
      sql`${idempotencyKeys.createdAt} < datetime('now', ${`-${IDEMPOTENCY_KEY_MAX_AGE_HOURS}`} || ' hours')`,
    )
    .returning({ key: idempotencyKeys.key });

  const deleted = result.length;
  log.info('idempotency cleanup complete', { deleted });
  return { deleted };
}
