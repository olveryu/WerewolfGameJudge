import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { FIBKING_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/fibking/public';
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/undercover/public';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { expect, it } from 'vitest';

import { applyMigration, listMigrationNames, readMigration } from './support/d1Migrations';

/** Last migration written before these rules existed; later files must follow every rule. */
const RULES_BASELINE = '0094_toolbox_presets.sql';
const MANIFEST_PATH = 'contracts/d1MigrationManifest.json';

interface RebuildViolation {
  migration: string;
  problem: string;
}

function captured(match: RegExpMatchArray, group: number): string {
  const value = match[group];
  if (value === undefined) {
    throw new Error(`Pattern ${match[0]} has no capture group ${group}`);
  }
  return value;
}

function rebuiltTables(sql: string): string[] {
  const created = [...sql.matchAll(/CREATE TABLE\s+"?(\w+)_next"?\s*\(/g)].map((match) =>
    captured(match, 1),
  );
  return created.filter((table) => new RegExp(`DROP TABLE\\s+"?${table}"?\\s*;`).test(sql));
}

function createTableBody(sql: string, table: string): string {
  const start = sql.search(new RegExp(`CREATE TABLE\\s+"?${table}"?\\s*\\(`));
  if (start < 0) return '';
  const end = sql.indexOf('\n);', start);
  return sql.slice(start, end < 0 ? undefined : end);
}

function childTables(database: DatabaseSync, parent: string): string[] {
  return database
    .prepare(
      `SELECT DISTINCT tables.name AS child FROM sqlite_master AS tables
       JOIN pragma_foreign_key_list(tables.name) AS keys
       WHERE tables.type = 'table' AND keys."table" = ? AND tables.name <> ?`,
    )
    .all(parent, parent)
    .map((row) => String(row.child));
}

function referencingTriggers(database: DatabaseSync, table: string) {
  const pattern = new RegExp(`\\b${table}\\b`);
  return database
    .prepare("SELECT name, tbl_name AS onTable, sql FROM sqlite_master WHERE type = 'trigger'")
    .all()
    .map((row) => ({ name: String(row.name), onTable: String(row.onTable), sql: String(row.sql) }))
    .filter((trigger) => trigger.onTable === table || pattern.test(trigger.sql));
}

function checkRebuild(database: DatabaseSync, migration: string, sql: string): RebuildViolation[] {
  const rebuilt = rebuiltTables(sql);
  const violations: RebuildViolation[] = [];
  for (const parent of rebuilt) {
    for (const child of childTables(database, parent)) {
      if (!rebuilt.includes(child)) {
        violations.push({ migration, problem: `${parent} rebuilt without its child ${child}` });
        continue;
      }
      const body = createTableBody(sql, `${child}_next`);
      if (new RegExp(`REFERENCES\\s+"?${parent}"?\\s*\\(`).test(body)) {
        violations.push({
          migration,
          problem: `${child}_next references ${parent} instead of ${parent}_next`,
        });
      }
    }
    for (const trigger of referencingTriggers(database, parent)) {
      const recreated = new RegExp(`CREATE TRIGGER\\s+${trigger.name}\\b`).test(sql);
      const dropped =
        trigger.onTable === parent || new RegExp(`DROP TRIGGER\\s+${trigger.name}\\b`).test(sql);
      if (!recreated || !dropped) {
        violations.push({
          migration,
          problem: `trigger ${trigger.name} referencing ${parent} is not dropped and recreated`,
        });
      }
    }
  }
  return violations;
}

it('every rebuilt parent table rebuilds all foreign-key descendants and referencing triggers', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    const violations: RebuildViolation[] = [];
    for (const name of listMigrationNames()) {
      // Applied migrations are immutable (manifest below); 0036 and 0087 rebuilt children in a
      // later step against the renamed parent, an ordering this structural check does not model.
      if (name > RULES_BASELINE)
        violations.push(...checkRebuild(database, name, readMigration(name)));
      applyMigration(database, name);
    }
    expect(violations).toEqual([]);
  } finally {
    database.close();
  }
});

it('detects a rooms rebuild that omits a cascading child table', () => {
  // A rooms rebuild that leaves out decrypto_round_word_selections empties it: with foreign keys
  // on, DROP TABLE rooms runs an implicit DELETE whose CASCADE is not deferred. The check above
  // must flag that shape.
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    for (const name of listMigrationNames()) {
      if (name > RULES_BASELINE) break;
      applyMigration(database, name);
    }
    const incomplete = [
      'CREATE TABLE rooms_next (id TEXT PRIMARY KEY);',
      'DROP TABLE rooms;',
      ...childTables(database, 'rooms')
        .filter((child) => child !== 'decrypto_round_word_selections')
        .flatMap((child) => [
          `CREATE TABLE ${child}_next (room_id TEXT REFERENCES rooms_next(id)\n);`,
          `DROP TABLE ${child};`,
        ]),
    ].join('\n');
    expect(checkRebuild(database, 'probe', incomplete)).toContainEqual({
      migration: 'probe',
      problem: 'rooms rebuilt without its child decrypto_round_word_selections',
    });
  } finally {
    database.close();
  }
});

it('new migrations never reset defer_foreign_keys', () => {
  // Cloudflare D1: turning defer_foreign_keys off discards unresolved violations instead of
  // failing the migration. SQLite resets the pragma at COMMIT, so the reset is never needed.
  const offenders = listMigrationNames()
    .filter((name) => name > RULES_BASELINE)
    .filter((name) =>
      /PRAGMA\s+defer_foreign_keys\s*=\s*(false|off|0)\b/i.test(readMigration(name)),
    );
  expect(offenders).toEqual([]);
});

it('new migrations never encode game or category lists in CHECK constraints', () => {
  const catalogued = new Set<string>([
    ...GAME_TYPES,
    ...FIBKING_WORD_CATEGORY_CATALOG.ids,
    ...UNDERCOVER_WORD_CATEGORY_CATALOG.ids,
    ...DRAWGUESS_WORD_CATEGORY_CATALOG.ids,
    ...DECRYPTO_WORD_CATEGORY_CATALOG.ids,
  ]);
  const offenders = listMigrationNames()
    .filter((name) => name > RULES_BASELINE)
    .flatMap((name) =>
      [...readMigration(name).matchAll(/CHECK\s*\([^;]*?\bIN\s*\(([^)]*)\)/gi)]
        .filter((match) =>
          [...captured(match, 1).matchAll(/'([^']*)'/g)].some((value) =>
            catalogued.has(captured(value, 1)),
          ),
        )
        .map((match) => `${name}: ${match[0].slice(0, 80)}`),
    );
  expect(offenders).toEqual([]);
});

it('migration files match the recorded sha256 manifest', () => {
  // Wrangler records applied migrations by file name only, so an edited file is silently skipped
  // where it already ran. Applied files are immutable; a new file is registered here.
  const manifest: unknown = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const actual = Object.fromEntries(
    listMigrationNames().map((name) => [
      name,
      createHash('sha256').update(readMigration(name)).digest('hex'),
    ]),
  );
  expect(actual).toEqual(manifest);
});
