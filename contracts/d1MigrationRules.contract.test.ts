import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { WORD_CATEGORY_CATALOGS } from '@game-judge/game-engine/games/wordCategoryCatalogs';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyMigration,
  latestMigrationName,
  listMigrationNames,
  readMigration,
} from './support/d1Migrations';
import { identifierName, patternProblems, sqlStatements, sqlTokens } from './support/d1Sql';

/** Last migration written before these rules existed; later files must follow every rule. */
const RULES_BASELINE = '0094_toolbox_presets.sql';
const MANIFEST_PATH = 'contracts/d1MigrationManifest.json';
/** A SQLite identifier in any quoting SQLite accepts: bare, "double", `backtick` or [bracket]. */
const IDENT = String.raw`(?:"(\w+)"|\x60(\w+)\x60|\[(\w+)\]|(\w+))`;
/** An optional `main.` (or `temp.`) schema prefix, quoted or not. */
const SCHEMA_PREFIX = String.raw`(?:(?:"\w+"|\x60\w+\x60|\[\w+\]|\w+)\s*\.\s*)?`;
/** A table name with optional schema prefix; the name is whichever of four groups matched. */
const TABLE_NAME = `${SCHEMA_PREFIX}${IDENT}`;

/** Pattern source for the known identifier `name`, schema-prefixed and quoted any way. */
function named(name: string): string {
  return String.raw`${SCHEMA_PREFIX}(?:"${name}"|\x60${name}\x60|\[${name}\]|${name}\b)`;
}

interface RebuildViolation {
  migration: string;
  problem: string;
}

/** SQL without `--` line or block comments, so commented-out statements never count. */
function stripComments(sql: string): string {
  return sqlTokens(sql)
    .map((token) => (token.kind === 'comment' ? ' ' : token.text))
    .join('');
}

/** The identifier a TABLE_NAME match captured, starting at group `first`. */
function identifier(match: RegExpMatchArray, first: number): string | undefined {
  for (let group = first; group < first + 4; group += 1) {
    const value = match[group];
    if (value !== undefined) return value;
  }
  return undefined;
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
  // Groups: 1–4 created, 5–8 renamed from, 9–12 renamed to, 13–16 dropped.
  const statement = new RegExp(
    [
      // `\s*` after TABLE: SQLite accepts a quoted name with no space (`DROP TABLE"rooms"`).
      String.raw`\bCREATE\s+TABLE\s*(?:IF\s+NOT\s+EXISTS\s+)?${TABLE_NAME}`,
      String.raw`\bALTER\s+TABLE\s*${TABLE_NAME}\s+RENAME\s+TO\s*${IDENT}`,
      String.raw`\bDROP\s+TABLE\s*(?:IF\s+EXISTS\s+)?${TABLE_NAME}`,
    ].join('|'),
    'gi',
  );
  for (const match of stripComments(sql).matchAll(statement)) {
    const createdName = identifier(match, 1);
    const renamedFrom = identifier(match, 5);
    const renamedTo = identifier(match, 9);
    const droppedName = identifier(match, 13);
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
    new RegExp(String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${named(table)}\s*\(`, 'i'),
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
  const start = text.search(
    new RegExp(String.raw`CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?${named(trigger)}`, 'i'),
  );
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
        new RegExp(String.raw`REFERENCES\s+${named(parent)}\s*\(`, 'i').test(body)
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
        new RegExp(
          String.raw`DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?${named(trigger.name)}`,
          'i',
        ).test(stripComments(sql));
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

/** Every table's b-tree root page: a table SQLite dropped and recreated gets a new one. */
function tableRootPages(database: DatabaseSync): Map<string, number> {
  return new Map(
    database
      .prepare("SELECT name, rootpage FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => [String(row.name), Number(row.rootpage)]),
  );
}

/**
 * Pre-existing tables whose b-tree did not survive the file: the name is gone (and its root page
 * did not move to a renamed table) or now sits on a different root page. A cross-check on the
 * text parse above, not a proof: SQLite can reuse a freed root page, so a DROP + CREATE of the
 * same name inside one file may keep the page and pass unseen here.
 */
function structurallyDropped(
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): string[] {
  const renamedPages = new Set(
    [...after].filter(([name]) => !before.has(name)).map(([, rootpage]) => rootpage),
  );
  return [...before]
    .filter(([name, rootpage]) =>
      after.has(name) ? after.get(name) !== rootpage : !renamedPages.has(rootpage),
    )
    .map(([name]) => name)
    .sort();
}

it('every rebuilt parent table rebuilds all foreign-key descendants and referencing triggers', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('PRAGMA foreign_keys = ON');
    const violations: RebuildViolation[] = [];
    const unparsedDrops: string[] = [];
    for (const name of listMigrationNames()) {
      // Applied migrations are immutable (manifest below); 0036 and 0087 rebuilt children in a
      // later step against the renamed parent, an ordering this structural check does not model.
      const checked = name > RULES_BASELINE;
      const sql = readMigration(name);
      const parsed = checked ? tableEffects(database, sql).dropped : new Set<string>();
      if (checked) violations.push(...checkRebuild(database, name, sql));
      const before = tableRootPages(database);
      applyMigration(database, name);
      if (checked) {
        for (const table of structurallyDropped(before, tableRootPages(database))) {
          if (!parsed.has(table)) unparsedDrops.push(`${name}: ${table}`);
        }
      }
    }
    expect(violations).toEqual([]);
    // A DROP the parse misses would skip the descendant check; the root-page cross-check catches
    // the ones that leave a trace in sqlite_master.
    expect(unparsedDrops).toEqual([]);
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

  it('sees a drop after a string that holds comment markers', () => {
    for (const sql of [
      "UPDATE game_types SET id = '--' WHERE 0; DROP TABLE rooms;",
      "SELECT ('/*'); DROP TABLE rooms; SELECT ('*/');",
    ]) {
      expect(problems(sql)).toEqual(missingFromRooms(roomsDescendants));
    }
  });

  it('sees a parent drop however the table name is spelled', () => {
    for (const spelling of [
      'DROP TABLE main.rooms;',
      'DROP TABLE "main"."rooms";',
      'DROP TABLE \x60rooms\x60;',
      'DROP TABLE [rooms];',
      'DROP /* rebuild */ TABLE IF EXISTS rooms;',
      'DROP TABLE"rooms";',
    ]) {
      expect(problems(spelling), spelling).toEqual(missingFromRooms(roomsDescendants));
    }
    expect(problems('-- DROP TABLE rooms;\n/* DROP TABLE rooms; */')).toEqual([]);
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

/**
 * Every `PRAGMA [schema.]defer_foreign_keys` statement in `sql` that leaves the pragma off.
 * SQLite itself judges the value: a statement is run on a scratch connection with the pragma on,
 * and offends when the pragma reads back 0. Any value SQLite does not read as true (`false`,
 * `'off'`, `0.5`, `full`, …) turns it off, so no list of false spellings is kept here.
 */
function deferForeignKeysResets(sql: string): string[] {
  return sqlStatements(sql)
    .filter(({ tokens: [keyword, ...rest] }) => {
      if (identifierName(keyword) !== 'pragma') return false;
      const name = rest[1]?.text === '.' ? rest[2] : rest[0];
      return identifierName(name) === 'defer_foreign_keys';
    })
    .map((statement) => statement.text.trim())
    .filter((statement) => {
      const scratch = new DatabaseSync(':memory:');
      try {
        try {
          scratch.exec(`BEGIN; PRAGMA defer_foreign_keys = ON; ${statement};`);
        } catch (error) {
          throw new Error(
            `SQLite rejected "${statement}" while reading its defer_foreign_keys value`,
            {
              cause: error,
            },
          );
        }
        const row = scratch.prepare('PRAGMA defer_foreign_keys').get();
        if (row === undefined) throw new Error('PRAGMA defer_foreign_keys returned no row');
        return row.defer_foreign_keys === 0;
      } finally {
        scratch.close();
      }
    });
}

it('new migrations never reset defer_foreign_keys', () => {
  // Turning defer_foreign_keys off inside a transaction discards unresolved violations, so COMMIT
  // succeeds and foreign_key_check reports them afterwards; the next test pins that behaviour.
  // SQLite resets the pragma at COMMIT, so the reset is never needed.
  const offenders = listMigrationNames()
    .filter((name) => name > RULES_BASELINE)
    .flatMap((name) =>
      deferForeignKeysResets(readMigration(name)).map((statement) => `${name}: ${statement}`),
    );
  expect(offenders).toEqual([]);
});

it('the root-page cross-check counts drops and rebuilds but not renames', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`CREATE TABLE kept (id INTEGER PRIMARY KEY);
      CREATE TABLE renamed (id INTEGER PRIMARY KEY);
      CREATE TABLE dropped (id INTEGER PRIMARY KEY);
      CREATE TABLE rebuilt (id INTEGER PRIMARY KEY);`);
    const before = tableRootPages(database);
    database.exec(`ALTER TABLE renamed RENAME TO renamed_away;
      DROP TABLE dropped;
      CREATE TABLE rebuilt_next (id INTEGER PRIMARY KEY);
      DROP TABLE rebuilt;
      ALTER TABLE rebuilt_next RENAME TO rebuilt;`);
    expect(structurallyDropped(before, tableRootPages(database))).toEqual(['dropped', 'rebuilt']);
  } finally {
    database.close();
  }
});

it('resetting defer_foreign_keys inside a transaction lets a violation commit', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE parent (id TEXT PRIMARY KEY);
      CREATE TABLE child (parent_id TEXT NOT NULL REFERENCES parent(id));`);
    database.exec(`BEGIN;
      PRAGMA defer_foreign_keys = true;
      INSERT INTO child (parent_id) VALUES ('missing');
      PRAGMA defer_foreign_keys = false;
      COMMIT;`);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toHaveLength(1);
  } finally {
    database.close();
  }
});

it('the defer_foreign_keys guard finds every statement that turns the pragma off', () => {
  for (const value of ['false', 'FALSE', 'off', 'no', '0', '00', "'false'", '"off"', 'full']) {
    expect(deferForeignKeysResets(`PRAGMA defer_foreign_keys = ${value};`), value).toHaveLength(1);
  }
  for (const value of ['true', 'on', 'yes', '1', "'on'"]) {
    expect(deferForeignKeysResets(`PRAGMA defer_foreign_keys = ${value};`), value).toEqual([]);
  }
  for (const statement of [
    'PRAGMA main.defer_foreign_keys = false;',
    'PRAGMA defer_foreign_keys(false);',
    'PRAGMA defer_foreign_keys (0);',
    'PRAGMA "defer_foreign_keys" = 0;',
    'pragma "main".defer_foreign_keys = OFF',
    'PRAGMA defer_foreign_keys = /* c */ false;',
    'PRAGMA /* c */ defer_foreign_keys = false;',
    'PRAGMA\n  defer_foreign_keys\n  = false',
    'CREATE TABLE t (id TEXT);\nPRAGMA defer_foreign_keys = false -- end',
  ]) {
    expect(deferForeignKeysResets(statement), statement).toHaveLength(1);
  }
  for (const statement of [
    'PRAGMA main.defer_foreign_keys(true);',
    'PRAGMA defer_foreign_keys;',
    '-- PRAGMA defer_foreign_keys = false;',
    '/* PRAGMA defer_foreign_keys = false; */',
    "INSERT INTO notes (body) VALUES ('PRAGMA defer_foreign_keys = off;');",
    'PRAGMA foreign_keys = false;',
  ]) {
    expect(deferForeignKeysResets(statement), statement).toEqual([]);
  }
});

/**
 * String literals naming a catalogued game or category inside any `CHECK (…)`, however the list
 * is written: `IN (…)`, `=`/`OR` chains, comments or nested parentheses in between.
 */
function cataloguedCheckValues(sql: string, catalogued: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const { tokens } of sqlStatements(sql)) {
    tokens.forEach((token, index) => {
      if (identifierName(token) !== 'check' || tokens[index + 1]?.text !== '(') return;
      let depth = 0;
      for (const inner of tokens.slice(index + 1)) {
        if (inner.text === '(') depth += 1;
        if (inner.text === ')') depth -= 1;
        const value = inner.kind === 'string' ? inner.text.slice(1, -1).replaceAll("''", "'") : '';
        if (catalogued.has(value)) found.push(`CHECK names '${value}'`);
        if (depth === 0) break;
      }
    });
  }
  return found;
}

const CATALOGUED_IDS: ReadonlySet<string> = new Set([
  ...GAME_TYPES,
  ...Object.values(WORD_CATEGORY_CATALOGS).flatMap((catalog) => catalog.ids),
]);

it('new migrations never encode game or category lists in CHECK constraints', () => {
  const offenders = listMigrationNames()
    .filter((name) => name > RULES_BASELINE)
    .flatMap((name) =>
      cataloguedCheckValues(readMigration(name), CATALOGUED_IDS).map(
        (problem) => `${name}: ${problem}`,
      ),
    );
  expect(offenders).toEqual([]);
});

it('the CHECK list guard reads the constraint as SQLite lexes it', () => {
  for (const sql of [
    "CREATE TABLE t (game TEXT CHECK (game IN ('werewolf')));",
    "CREATE TABLE t (game TEXT CHECK (game IN /* c */ ('werewolf')));",
    "CREATE TABLE t (game TEXT CHECK -- c\n  (game IN ('werewolf')));",
    "CREATE TABLE t (game TEXT, CHECK (game = 'werewolf' OR game = 'avalon'));",
    "CREATE TABLE t (game TEXT CONSTRAINT g CHECK ((game) IN ('werewolf', 'avalon')));",
    "CREATE TABLE t (category TEXT CHECK\n  (category IN (\n  'food' -- first\n  )));",
  ]) {
    expect(cataloguedCheckValues(sql, CATALOGUED_IDS), sql).not.toEqual([]);
  }
  for (const sql of [
    "-- CREATE TABLE t (game TEXT CHECK (game IN ('werewolf')));",
    "INSERT INTO notes (body) VALUES ('CHECK (game IN (''werewolf''))');",
    "CREATE TABLE t (game TEXT REFERENCES game_types(id), CHECK (game <> ''));",
    "CREATE TABLE t (game TEXT CHECK (length(game) > 0), note TEXT DEFAULT 'werewolf');",
    "INSERT INTO game_types (id, sort_order) VALUES ('werewolf', 0);",
  ]) {
    expect(cataloguedCheckValues(sql, CATALOGUED_IDS), sql).toEqual([]);
  }
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

it("every LIKE and GLOB pattern is a literal within D1's 50-byte limit", () => {
  const problems = listMigrationNames().flatMap((name) =>
    patternProblems(readMigration(name)).map((problem) => `${name}: ${problem}`),
  );
  expect(problems).toEqual([]);
});

it('flags a computed pattern and a literal over 50 bytes', () => {
  expect(patternProblems("CHECK (name NOT GLOB ('[' || char(9, 32) || ']*'))")).toEqual([
    "GLOB(…) hides its pattern; write x GLOB '<literal>'",
  ]);
  expect(patternProblems("CHECK (glob('[a-z]*', id) AND like('a%', n) AND id GLOB('x'))")).toEqual([
    "glob(…) hides its pattern; write x glob '<literal>'",
    "like(…) hides its pattern; write x like '<literal>'",
    "GLOB(…) hides its pattern; write x GLOB '<literal>'",
  ]);
  // Identifiers that merely contain the word, quoted on one side, both sides or not at all.
  expect(
    patternProblems(
      'CREATE TABLE t (likes_count INTEGER, globals TEXT, likelihood REAL, "like" TEXT, "like me" TEXT, "my like" TEXT, [glob] TEXT, \x60glob\x60 TEXT)',
    ),
  ).toEqual([]);
  expect(patternProblems("CHECK (n LIKE'a%' AND n NOT LIKE 'b%' ESCAPE '!')")).toEqual([]);
  expect(patternProblems('CHECK (id GLOB\n  name)')).toEqual([
    'GLOB name is not a literal pattern',
  ]);
  // A keyword touching a quoted name is checked like the spaced spelling.
  expect(
    patternProblems(`CHECK ("col"GLOB ${"'" + '[0-9]'.repeat(11) + "'"} AND \x60c\x60LIKE 'a%')`),
  ).toEqual(["GLOB pattern of 55 bytes exceeds D1's 50"]);
  expect(patternProblems('CHECK (x GLOB"col" AND y LIKE\x60c\x60)')).toEqual([
    'GLOB "col" is not a literal pattern',
    'LIKE \x60c\x60 is not a literal pattern',
  ]);
  // A keyword inside a string is data: it neither hides a later pattern nor raises a problem.
  expect(
    patternProblems(
      `CHECK (note <> 'foo LIKE' AND t <> 'it''s GLOB' AND code GLOB ${"'" + '[0-9]'.repeat(11) + "'"})`,
    ),
  ).toEqual(["GLOB pattern of 55 bytes exceeds D1's 50"]);
  expect(patternProblems("INSERT INTO t VALUES ('x', 'I like cats', '/* glob */')")).toEqual([]);
  expect(patternProblems("CHECK (code GLOB '[0-9]' || '[0-9]')")).toEqual([
    "GLOB '[0-9]' || … is not a literal pattern",
  ]);
  // A string holding -- is data, not a comment.
  expect(
    patternProblems(`CHECK (a <> '--' AND code GLOB ${"'" + '[0-9]'.repeat(11) + "'"})`),
  ).toEqual(["GLOB pattern of 55 bytes exceeds D1's 50"]);
  expect(patternProblems(`CHECK (code GLOB '${'[0-9]'.repeat(11)}')`)).toEqual([
    "GLOB pattern of 55 bytes exceeds D1's 50",
  ]);
  expect(patternProblems("CHECK (id NOT GLOB '*[^a-z0-9]*' AND n LIKE 'it''s%')")).toEqual([]);
  // '' is one byte of pattern: 49 quotes plus 'x' fit, 50 quotes plus 'x' do not.
  expect(patternProblems(`CHECK (n LIKE '${"''".repeat(49)}x')`)).toEqual([]);
  expect(patternProblems(`CHECK (n LIKE '${"''".repeat(50)}x')`)).toEqual([
    "LIKE pattern of 51 bytes exceeds D1's 50",
  ]);
});
