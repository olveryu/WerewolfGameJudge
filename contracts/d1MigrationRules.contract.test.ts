import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { FIBKING_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/fibking/public';
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/undercover/public';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyMigration,
  latestMigrationName,
  listMigrationNames,
  readMigration,
} from './support/d1Migrations';

/** Last migration written before these rules existed; later files must follow every rule. */
const RULES_BASELINE = '0094_toolbox_presets.sql';
const MANIFEST_PATH = 'contracts/d1MigrationManifest.json';
/** `PRAGMA defer_foreign_keys` set to any of SQLite's false spellings, optionally quoted. */
const DEFER_FOREIGN_KEYS_RESET =
  /PRAGMA\s+defer_foreign_keys\s*=\s*['"]?(?:false|off|no|0)['"]?\s*(?:;|$)/im;

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

/** SQL without `--` line comments, so commented-out statements never count. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

interface TableEffects {
  /** Pre-existing tables the file drops, directly or after renaming them. */
  readonly dropped: ReadonlySet<string>;
  /** Pre-existing table name → the name it was created under in this file, when it exists again. */
  readonly recreatedFrom: ReadonlyMap<string, string>;
}

/**
 * Follows every CREATE TABLE, ALTER TABLE … RENAME TO and DROP TABLE in file order, so a parent is
 * recognised however it is rebuilt: `<t>_next`/`_new`/`_v2` staging renamed onto it, renaming it
 * away first and dropping the renamed copy, or dropping it outright.
 */
function tableEffects(database: DatabaseSync, sql: string): TableEffects {
  const existing = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name)),
  );
  // Current name → origin: a pre-existing table, or the name a new table was created under.
  const current = new Map<string, { readonly existing: string } | { readonly created: string }>(
    [...existing].map((name) => [name, { existing: name }]),
  );
  const dropped = new Set<string>();
  const statement =
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?|\bALTER\s+TABLE\s+"?(\w+)"?\s+RENAME\s+TO\s+"?(\w+)"?|\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi;
  for (const match of stripComments(sql).matchAll(statement)) {
    const [, createdName, renamedFrom, renamedTo, droppedName] = match;
    if (createdName !== undefined) {
      current.set(createdName, { created: createdName });
    } else if (renamedFrom !== undefined && renamedTo !== undefined) {
      const origin = current.get(renamedFrom);
      if (origin === undefined) throw new Error(`RENAME of unknown table ${renamedFrom}`);
      current.delete(renamedFrom);
      current.set(renamedTo, origin);
    } else if (droppedName !== undefined) {
      const origin = current.get(droppedName);
      if (origin !== undefined && 'existing' in origin) dropped.add(origin.existing);
      current.delete(droppedName);
    }
  }
  const recreatedFrom = new Map<string, string>();
  for (const table of dropped) {
    const origin = current.get(table);
    if (origin !== undefined && 'created' in origin) recreatedFrom.set(table, origin.created);
  }
  return { dropped, recreatedFrom };
}

/** The parenthesised body of `CREATE TABLE <table> (…)`, matched by depth rather than layout. */
function createTableBody(sql: string, table: string): string {
  const start = stripComments(sql).search(
    new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${table}"?\\s*\\(`, 'i'),
  );
  if (start < 0) return '';
  const text = stripComments(sql);
  const open = text.indexOf('(', start);
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    if (text[index] === ')') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  return text.slice(start);
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

function descendantTables(database: DatabaseSync, parent: string): string[] {
  const found = new Set<string>();
  const pending = [parent];
  for (let table = pending.pop(); table !== undefined; table = pending.pop()) {
    for (const child of childTables(database, table)) {
      if (child !== parent && !found.has(child)) {
        found.add(child);
        pending.push(child);
      }
    }
  }
  return [...found];
}

function normalizedSql(sql: string): string {
  return stripComments(sql)
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/, '')
    .trim();
}

function createTriggerStatement(sql: string, trigger: string): string | undefined {
  const text = stripComments(sql);
  const start = text.search(new RegExp(`CREATE\\s+TRIGGER\\s+"?${trigger}"?\\b`, 'i'));
  if (start < 0) return undefined;
  const end = text.slice(start).search(/\bEND\s*;/i);
  return end < 0 ? text.slice(start) : text.slice(start, start + end + 3);
}

/**
 * Checks one migration against the schema it runs on (`database` holds every earlier file).
 * Every pre-existing table the file drops counts as a parent: all of its foreign-key
 * descendants must be dropped in the same file too, and recreated when the parent is; a child
 * rebuilt alongside a parent staged under another name must reference that staging table; and
 * every trigger referencing a dropped table must be dropped and recreated verbatim.
 */
function checkRebuild(database: DatabaseSync, migration: string, sql: string): RebuildViolation[] {
  const { dropped, recreatedFrom } = tableEffects(database, sql);
  const violations: RebuildViolation[] = [];
  for (const parent of dropped) {
    const parentStaging = recreatedFrom.get(parent);
    for (const descendant of descendantTables(database, parent)) {
      if (!dropped.has(descendant)) {
        // Any drop of a pre-existing table is a rebuild here, an outright DROP included.
        const relation = childTables(database, parent).includes(descendant)
          ? 'child'
          : 'descendant';
        violations.push({
          migration,
          problem: `${parent} rebuilt without its ${relation} ${descendant}`,
        });
        continue;
      }
      const descendantStaging = recreatedFrom.get(descendant);
      if (parentStaging === undefined) continue;
      if (descendantStaging === undefined) {
        violations.push({
          migration,
          problem: `${parent} rebuilt but its descendant ${descendant} is not recreated`,
        });
        continue;
      }
      const body = createTableBody(sql, descendantStaging);
      if (
        parentStaging !== parent &&
        new RegExp(`REFERENCES\\s+"?${parent}"?\\s*\\(`, 'i').test(body)
      ) {
        violations.push({
          migration,
          problem: `${descendantStaging} references ${parent} instead of ${parentStaging}`,
        });
      }
    }
    for (const trigger of referencingTriggers(database, parent)) {
      const dropsTrigger =
        trigger.onTable === parent ||
        new RegExp(`DROP\\s+TRIGGER\\s+(?:IF\\s+EXISTS\\s+)?"?${trigger.name}"?\\b`, 'i').test(
          stripComments(sql),
        );
      const recreated = createTriggerStatement(sql, trigger.name);
      if (!dropsTrigger || recreated === undefined) {
        violations.push({
          migration,
          problem: `trigger ${trigger.name} referencing ${parent} is not dropped and recreated`,
        });
      } else if (normalizedSql(recreated) !== normalizedSql(trigger.sql)) {
        violations.push({
          migration,
          problem: `trigger ${trigger.name} referencing ${parent} is not recreated verbatim`,
        });
      }
    }
  }
  return violations;
}

/** A database holding every migration through `last`, foreign keys on. */
function databaseThrough(last: string): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  for (const name of listMigrationNames()) {
    if (name > last) break;
    applyMigration(database, name);
  }
  return database;
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

/**
 * Probe SQL (never written as a migration file) rebuilding `parent` and every descendant through
 * staging tables named by `staging`; each staging child references its parent's staging table
 * unless `referenceParentByOldName` reproduces the bug of pointing at the table being dropped.
 */
function stagedRebuild(
  database: DatabaseSync,
  parent: string,
  staging: (table: string) => string,
  options: { readonly omit?: string; readonly referenceParentByOldName?: boolean } = {},
): string {
  const statements = [`CREATE TABLE ${staging(parent)} (id TEXT PRIMARY KEY);`];
  const rebuilt = [parent];
  for (const child of childTables(database, parent).filter((table) => table !== options.omit)) {
    const target = options.referenceParentByOldName === true ? parent : staging(parent);
    statements.push(`CREATE TABLE ${staging(child)} (room_id TEXT REFERENCES ${target}(id));`);
    rebuilt.push(child);
  }
  for (const table of [...rebuilt].reverse()) statements.push(`DROP TABLE ${table};`);
  for (const table of rebuilt) statements.push(`ALTER TABLE ${staging(table)} RENAME TO ${table};`);
  return statements.join('\n');
}

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

describe('rebuild guard probes on the current schema', () => {
  let database: DatabaseSync;
  let roomsDescendants: string[];

  beforeEach(() => {
    database = databaseThrough(latestMigrationName());
    roomsDescendants = descendantTables(database, 'rooms').sort();
    expect(roomsDescendants.length).toBeGreaterThan(0);
  });

  afterEach(() => {
    database.close();
  });

  function problems(sql: string): string[] {
    return checkRebuild(database, 'probe', sql)
      .map((violation) => violation.problem)
      .sort();
  }

  it('accepts a complete staged rebuild under any staging name', () => {
    for (const suffix of ['_next', '_new', '_v2']) {
      expect(problems(stagedRebuild(database, 'rooms', (table) => `${table}${suffix}`))).toEqual(
        [],
      );
    }
  });

  /** The guard's message for each rooms descendant left behind, worded by direct child or not. */
  function missingFromRooms(tables: readonly string[]): string[] {
    const children = childTables(database, 'rooms');
    return tables.map(
      (table) =>
        `rooms rebuilt without its ${children.includes(table) ? 'child' : 'descendant'} ${table}`,
    );
  }

  it('flags a parent dropped outright while its descendants stay', () => {
    expect(problems('DROP TABLE rooms;')).toEqual(missingFromRooms(roomsDescendants));
  });

  it('flags a rename-away rebuild that leaves descendants on the renamed copy', () => {
    const sql = [
      'ALTER TABLE rooms RENAME TO rooms_old;',
      'CREATE TABLE rooms (id TEXT PRIMARY KEY);',
      'DROP TABLE rooms_old;',
    ].join('\n');
    expect(problems(sql)).toEqual(missingFromRooms(roomsDescendants));
  });

  it('flags any staging name that omits a descendant or references the dropped parent', () => {
    expect(
      problems(
        stagedRebuild(database, 'rooms', (table) => `${table}_v2`, {
          omit: 'room_participants',
        }),
      ),
    ).toEqual(missingFromRooms(['room_participants']));
    expect(
      problems(
        stagedRebuild(database, 'rooms', (table) => `${table}_new`, {
          referenceParentByOldName: true,
        }),
      ),
    ).toEqual(
      childTables(database, 'rooms')
        .map((child) => `${child}_new references rooms instead of rooms_new`)
        .sort(),
    );
  });

  it('requires triggers on a rebuilt table to be recreated verbatim', () => {
    const triggers = referencingTriggers(database, 'user_stats');
    expect(triggers.length).toBeGreaterThan(0);
    const rebuild = stagedRebuild(database, 'user_stats', (table) => `${table}_next`);
    expect(problems(rebuild)).toEqual(
      triggers
        .map(
          (trigger) =>
            `trigger ${trigger.name} referencing user_stats is not dropped and recreated`,
        )
        .sort(),
    );
    const verbatim = triggers.map((trigger) => `${trigger.sql};`);
    expect(problems([rebuild, ...verbatim].join('\n'))).toEqual([]);
    const [first, ...rest] = triggers;
    if (first === undefined) throw new Error('user_stats has no trigger');
    const edited = [
      rebuild,
      `${first.sql.replace(/\bBEGIN\b/, 'BEGIN SELECT 1;')};`,
      ...rest.map((trigger) => `${trigger.sql};`),
    ];
    expect(problems(edited.join('\n'))).toEqual([
      `trigger ${first.name} referencing user_stats is not recreated verbatim`,
    ]);
  });
});

it('new migrations never reset defer_foreign_keys', () => {
  // SQLite itself (not only D1): turning defer_foreign_keys off inside a transaction discards
  // unresolved violations, so COMMIT succeeds and foreign_key_check then reports them (verified on
  // SQLite 3.53.4). SQLite resets the pragma at COMMIT, so the reset is never needed.
  const offenders = listMigrationNames()
    .filter((name) => name > RULES_BASELINE)
    .filter((name) => DEFER_FOREIGN_KEYS_RESET.test(readMigration(name)));
  expect(offenders).toEqual([]);
});

it('the defer_foreign_keys guard recognises every false spelling', () => {
  for (const value of ['false', 'FALSE', 'off', 'Off', 'no', 'NO', '0', "'false'", '"off"']) {
    expect(DEFER_FOREIGN_KEYS_RESET.test(`PRAGMA defer_foreign_keys = ${value};`), value).toBe(
      true,
    );
  }
  for (const value of ['true', 'on', 'yes', '1']) {
    expect(DEFER_FOREIGN_KEYS_RESET.test(`PRAGMA defer_foreign_keys = ${value};`), value).toBe(
      false,
    );
  }
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
