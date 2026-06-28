/**
 * Drizzle D1 driver instantiation
 *
 * Each request calls `createDb(env.DB)` to obtain a drizzle instance.
 * D1 binding lifecycle matches the request, no singleton cache needed.
 */

import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

/** Create a drizzle client bound to the current request's D1 instance. */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/** Drizzle client type (schema-bound), for passing the db handle into helpers. */
export type Db = ReturnType<typeof createDb>;
