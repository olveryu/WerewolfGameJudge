import { readdirSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIRECTORY = 'packages/api-worker/migrations';

/** Migration file names in Wrangler's application order. */
export function listMigrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function readMigration(name: string): string {
  return readFileSync(`${MIGRATIONS_DIRECTORY}/${name}`, 'utf8');
}

/**
 * Apply migrations in order through `lastMigration`, each inside one transaction like D1 does,
 * so deferred foreign-key violations surface at COMMIT instead of being silently tolerated.
 */
export function applyMigrationsThrough(database: DatabaseSync, lastMigration: string): void {
  const names = listMigrationNames();
  if (!names.includes(lastMigration)) throw new Error(`Missing migration ${lastMigration}`);
  for (const name of names) {
    if (name > lastMigration) break;
    applyMigration(database, name);
  }
}

export function applyMigration(database: DatabaseSync, name: string): void {
  database.exec('BEGIN');
  try {
    database.exec(readMigration(name));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw new Error(`Migration ${name} failed`, { cause: error });
  }
}

export function latestMigrationName(): string {
  const names = listMigrationNames();
  const latest = names.at(-1);
  if (latest === undefined) throw new Error('No migrations found');
  return latest;
}
