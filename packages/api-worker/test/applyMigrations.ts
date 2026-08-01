/** Apply the production D1 migration chain before Vitest snapshots isolated storage. */

import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

if (env.DB === undefined) {
  throw new Error('[FAIL-FAST] Worker tests require the DB binding');
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
