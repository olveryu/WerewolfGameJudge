/** Whole-database capacity policy; never delete durable account progress to reclaim space. */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { createLogger } from '../observability/logger';

const MEGABYTE = 1_000_000;
const WARNING_BYTES = 300 * MEGABYTE;
const PAUSE_BYTES = 375 * MEGABYTE;
const RESUME_BYTES = 350 * MEGABYTE;
const PROTECT_BYTES = 425 * MEGABYTE;
const PROTECT_RESUME_BYTES = 400 * MEGABYTE;
const MAX_MEASUREMENT_AGE_MS = 5 * 60 * 1000;
const capacityStateSchema = z.enum(['normal', 'warning', 'paused', 'protected']);
type CapacityState = z.output<typeof capacityStateSchema>;
const log = createLogger('database-capacity');

/** Apply hysteresis so temporary size fluctuations cannot repeatedly restart producers. */
export function determineDatabaseCapacityState(
  sizeBytes: number,
  previous: CapacityState,
): CapacityState {
  z.number().int().nonnegative().parse(sizeBytes);
  if (sizeBytes >= PROTECT_BYTES || (previous === 'protected' && sizeBytes >= PROTECT_RESUME_BYTES))
    return 'protected';
  if (
    sizeBytes >= PAUSE_BYTES ||
    ((previous === 'paused' || previous === 'protected') && sizeBytes >= RESUME_BYTES)
  )
    return 'paused';
  return sizeBytes >= WARNING_BYTES ? 'warning' : 'normal';
}

/** Measure actual D1 database bytes, including indexes; persist the control state. */
export async function measureDatabaseCapacity(db: D1Database): Promise<CapacityState> {
  const result = await db
    .prepare('SELECT state FROM database_capacity WHERE id = 1')
    .all<{ state: string }>();
  const row = result.results[0];
  if (row === undefined) throw new Error('Database capacity singleton missing');
  const previous = capacityStateSchema.parse(row.state);
  const state = determineDatabaseCapacityState(result.meta.size_after, previous);
  await db
    .prepare('UPDATE database_capacity SET size_bytes = ?, state = ?, measured_at = ? WHERE id = 1')
    .bind(result.meta.size_after, state, new Date().toISOString())
    .run();
  if (state !== previous)
    log.warn('database capacity changed', { previous, state, sizeBytes: result.meta.size_after });
  return state;
}

/** Reject new persistent entities at the protection watermark while allowing existing sessions. */
export async function requireDatabaseGrowthCapacity(db: D1Database): Promise<void> {
  const row = await db
    .prepare('SELECT state, measured_at FROM database_capacity WHERE id = 1')
    .first<{ state: string; measured_at: string }>();
  if (row === null) throw new Error('Database capacity singleton missing');
  const measuredAt = Date.parse(row.measured_at);
  if (!Number.isFinite(measuredAt)) throw new Error('Database capacity timestamp invalid');
  const state =
    Date.now() - measuredAt >= MAX_MEASUREMENT_AGE_MS
      ? await measureDatabaseCapacity(db)
      : capacityStateSchema.parse(row.state);
  if (state === 'protected')
    throw new HTTPException(503, { message: '存储空间不足，暂时无法创建，请稍后重试' });
}
