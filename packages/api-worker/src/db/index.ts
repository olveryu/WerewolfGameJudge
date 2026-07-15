/**
 * Drizzle D1 driver instantiation
 *
 * Each request calls `createDb(env.DB)` to obtain a drizzle instance.
 * D1 binding lifecycle matches the request, no singleton cache needed.
 */

import { drizzle } from 'drizzle-orm/d1';

/** Create a drizzle client bound to the current request's D1 instance. */
export function createDb(d1: D1Database) {
  return drizzle(d1);
}

/** Drizzle client type for passing the request-bound database handle into helpers. */
export type Db = ReturnType<typeof createDb>;
