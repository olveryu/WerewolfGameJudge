/** Account retention tasks invoked by the application scheduler. */

import { sql } from 'drizzle-orm';

import { createDb } from '../../db';
import type { Env } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { rooms } from '../../platform/room/dbSchema';
import { users } from './dbSchema';

const log = createLogger('account-maintenance');
const ANONYMOUS_INACTIVE_DAYS = 14;
const DELETE_BATCH_LIMIT = 1000;

/** Delete inactive anonymous users that do not own a room. */
export async function cleanupAnonymousUsers(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(users)
    .where(
      sql`${users.id} IN (
        SELECT ${users.id} FROM ${users}
        LEFT JOIN ${rooms} ON ${rooms.hostUserId} = ${users.id}
        WHERE ${users.isAnonymous} = 1
          AND ${users.updatedAt} < datetime('now', ${`-${ANONYMOUS_INACTIVE_DAYS}`} || ' days')
          AND ${rooms.id} IS NULL
        LIMIT ${DELETE_BATCH_LIMIT}
      )`,
    )
    .returning({ id: users.id });

  const deleted = result.length;
  log.info('anonymous user cleanup complete', { deleted });
  return { deleted };
}
