/**
 * Registration migration: judge the current D1 schema, then generate.
 *
 * The generator never derives SQL from an earlier migration. It replays
 * every migration under `packages/api-worker/migrations` in Wrangler
 * order into an in-memory SQLite database (one transaction per file,
 * foreign keys on, like D1), inspects the schema that actually results,
 * and only then emits the registration migration — row inserts into the
 * lookup tables, plus an optional brand-new stats table. Anything that
 * cannot be expressed that way (an existing registration, a hard-coded
 * game list in a CHECK, a missing lookup table, drift between the lookup
 * table and `GAME_TYPES`) stops generation with the problems listed, so a
 * human writes that migration by hand under the D1 rules in
 * `packages/api-worker/AGENTS.md`. The generated SQL is then applied to
 * the replayed database and the resulting rows are verified.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const MIGRATIONS_RELATIVE_DIR = 'packages/api-worker/migrations';

const HAND_WRITTEN_GUIDANCE = [
  'The generator only emits row inserts (and a brand-new stats table); it never rebuilds a table or edits a constraint.',
  'Write this migration by hand instead, following the D1 rules in packages/api-worker/AGENTS.md:',
  'rebuild a parent table only together with every foreign-key descendant and referencing trigger,',
  'state the one-off write estimate in the PR, merge only in a freshly reset quota window,',
  'and record the new file in contracts/d1MigrationManifest.json.',
].join('\n  ');

/** SQL a registration migration must never contain; a match means the plan is not inserts-only. */
const FORBIDDEN_STATEMENTS = [
  /\bDROP\s+(?:TABLE|INDEX|TRIGGER|VIEW)\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bRENAME\b/i,
  /\bPRAGMA\b/i,
  /\b\w+_next\b/i,
  /\bCHECK\s*\([^)]*\bIN\s*\(/i,
];

const GAME_COLUMN = /(?:^|_)game(?:_type)?$/;

function quote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

/** Pick the next migration number and file name from the existing directory listing. */
export function nextMigrationName(fileNames, gameId) {
  let max = 0;
  for (const name of fileNames) {
    const match = MIGRATION_FILE_PATTERN.exec(name);
    if (match !== null) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  if (max === 0) {
    throw new Error(
      `No NNNN_*.sql migration found among ${fileNames.length} files; cannot derive the next number for '${gameId}'.`,
    );
  }
  return `${String(max + 1).padStart(4, '0')}_${gameId}.sql`;
}

/** Migration file names in Wrangler's application order. */
function listMigrationFiles(migrationsDir) {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

/** Replay every migration into a fresh in-memory database, one transaction per file. */
export function replayMigrations(migrationsDir) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  for (const name of listMigrationFiles(migrationsDir)) {
    database.exec('BEGIN');
    try {
      database.exec(fs.readFileSync(path.join(migrationsDir, name), 'utf8'));
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      database.close();
      throw new Error(
        `Migration ${name} failed while replaying ${path.join(migrationsDir, name)}, so the current schema cannot be judged.`,
        { cause: error },
      );
    }
  }
  return database;
}

function tableColumns(database, table) {
  return database
    .prepare(`SELECT name FROM pragma_table_info(?)`)
    .all(table)
    .map((row) => row.name);
}

function hasColumns(database, table, required) {
  const columns = tableColumns(database, table);
  return columns.length > 0 && required.every((column) => columns.includes(column));
}

/**
 * Schema objects whose SQL hard-codes a game list: an `IN (...)` list on a
 * game column (`game`, `game_type`, `*_game`, `*_game_type`), or one naming
 * two or more known games. A single game id among other literals is not a
 * game list (`undercover` is also an undercover role). Changing such a
 * list is a constraint edit, which SQLite can only do by rebuilding.
 */
export function findHardCodedGameLists(database, knownGames) {
  const games = new Set(knownGames);
  const findings = [];
  const objects = database
    .prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`)
    .all();
  for (const object of objects) {
    for (const match of String(object.sql).matchAll(/([\w"`]+)\s+(?:NOT\s+)?IN\s*\(([^()]*)\)/gi)) {
      const column = match[1].replaceAll(/["`]/g, '').toLowerCase();
      const literals = [...match[2].matchAll(/'((?:[^']|'')*)'/g)].map((item) => item[1]);
      const namedGames = literals.filter((literal) => games.has(literal)).length;
      if (namedGames >= 2 || (literals.length > 0 && GAME_COLUMN.test(column))) {
        findings.push(`${object.type} ${object.name}`);
        break;
      }
    }
  }
  return findings;
}

/** Validate the approved category list the same way `defineWordCategoryCatalog` does. */
function wordCategoryProblems(gameId, categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [`word library for '${gameId}' needs a non-empty approved category list`];
  }
  const problems = [];
  const ids = new Set();
  const names = new Set();
  for (const entry of categories) {
    const { id, name } = entry;
    if (typeof id !== 'string' || typeof name !== 'string') {
      problems.push(
        `word category ${JSON.stringify(entry)} of '${gameId}' needs string id and name`,
      );
      continue;
    }
    if (id.trim() === '' || name.trim() === '' || id !== id.trim() || name !== name.trim()) {
      problems.push(
        `word category ${JSON.stringify(entry)} of '${gameId}' has a blank or padded id or name`,
      );
      continue;
    }
    // Category ids are TS identifiers in the generated wordCategories.ts and D1 CHECK ids:
    // lowercase first letter, letters and digits only (camelCase like sportsAndGames).
    if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) {
      problems.push(
        `word category id "${id}" of '${gameId}' must start lowercase and contain only letters and digits`,
      );
      continue;
    }
    if (ids.has(id)) problems.push(`word category id "${id}" of '${gameId}' is repeated`);
    if (names.has(name)) problems.push(`word category name "${name}" of '${gameId}' is repeated`);
    ids.add(id);
    names.add(name);
  }
  return problems;
}

/** Every reason the registration cannot be a plain insert against this schema. */
export function registrationPreflightProblems(
  database,
  { gameId, codeGameTypes, includeStatsTable, wordCategories },
) {
  const problems = [];
  const wordLibrary = wordCategories !== null;
  if (!hasColumns(database, 'game_types', ['id', 'sort_order'])) {
    problems.push('lookup table game_types (id, sort_order) is missing');
  } else {
    const rows = database
      .prepare('SELECT id, sort_order FROM game_types ORDER BY sort_order')
      .all();
    if (rows.some((row) => row.id === gameId)) {
      problems.push(`'${gameId}' is already registered in game_types`);
    } else {
      const ids = rows.map((row) => row.id);
      if (JSON.stringify(ids) !== JSON.stringify(codeGameTypes)) {
        problems.push(
          `game_types rows ${JSON.stringify(ids)} differ from GAME_TYPES ${JSON.stringify(codeGameTypes)}; reconcile the projection first`,
        );
      }
      if (rows.some((row, index) => row.sort_order !== index)) {
        problems.push('game_types sort_order is not the contiguous code order 0..n-1');
      }
    }
  }
  if (wordLibrary) {
    if (!hasColumns(database, 'word_games', ['game'])) {
      problems.push('lookup table word_games (game) is missing');
    } else if (database.prepare('SELECT 1 FROM word_games WHERE game = ?').get(gameId)) {
      problems.push(`'${gameId}' already has a word_games row`);
    }
    if (!hasColumns(database, 'word_categories', ['game', 'id', 'name', 'sort_order'])) {
      problems.push('lookup table word_categories (game, id, name, sort_order) is missing');
    } else if (database.prepare('SELECT 1 FROM word_categories WHERE game = ?').get(gameId)) {
      problems.push(`'${gameId}' already has word_categories rows`);
    }
    problems.push(...wordCategoryProblems(gameId, wordCategories));
  }
  const statsTable = `${gameId}_user_stats`;
  if (tableColumns(database, statsTable).length > 0) {
    problems.push(`table ${statsTable} already exists`);
  }
  if (includeStatsTable && !hasColumns(database, 'users', ['id'])) {
    problems.push('table users (id) is missing, so the stats table has no owner to reference');
  }
  for (const object of findHardCodedGameLists(database, [...codeGameTypes, gameId])) {
    problems.push(
      `${object} hard-codes a game list in its SQL; registering would need a constraint change and a table rebuild`,
    );
  }
  return problems;
}

/** Build the inserts-only registration SQL from the current state (never from an earlier migration). */
function buildRegistrationSql({ gameId, displayName, includeStatsTable, wordCategories }) {
  const lines = [
    `-- Register ${displayName} (${gameId}). Generated by \`pnpm new-game\` after replaying the`,
    `-- current migrations and checking the resulting schema; review it against this game's`,
    `-- requirements before committing (migration rules: packages/api-worker/AGENTS.md).`,
    `-- game_types is the projection of GAME_TYPES: the row lands last in sort_order.`,
    ``,
    `INSERT INTO game_types (id, sort_order) VALUES (${quote(gameId)}, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM game_types));`,
    ``,
  ];
  if (wordCategories !== null) {
    lines.push(
      `-- Word library: word_games plus the approved category catalog, in catalog order.`,
      `INSERT INTO word_games (game) VALUES (${quote(gameId)});`,
      `INSERT INTO word_categories (game, id, name, sort_order) VALUES`,
      wordCategories
        .map(
          (entry, index) =>
            `  (${quote(gameId)}, ${quote(entry.id)}, ${quote(entry.name)}, ${index})`,
        )
        .join(',\n') + ';',
      ``,
    );
  }
  if (includeStatsTable) {
    lines.push(
      `-- Cumulative completed games only; no fabricated outcomes or history backfill.`,
      `CREATE TABLE ${gameId}_user_stats (`,
      `  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,`,
      `  games_played INTEGER NOT NULL CHECK (typeof(games_played) = 'integer' AND games_played >= 0)`,
      `);`,
      ``,
      `-- TODO(gameplay): add only approved gameplay-specific metrics with an explicit migration policy.`,
      ``,
    );
  }
  return lines.join('\n');
}

function verifyAppliedRegistration(database, sql, options) {
  const { gameId, codeGameTypes, includeStatsTable, wordCategories } = options;
  for (const pattern of FORBIDDEN_STATEMENTS) {
    if (pattern.test(sql)) {
      throw new Error(`Generated registration for '${gameId}' matched ${pattern}; refusing.`);
    }
  }
  database.exec('BEGIN');
  try {
    database.exec(sql);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw new Error(
      `Generated registration for '${gameId}' does not apply to the schema replayed from the current migrations.`,
      { cause: error },
    );
  }
  const expected = [...codeGameTypes, gameId];
  const ids = database
    .prepare('SELECT id FROM game_types ORDER BY sort_order')
    .all()
    .map((row) => row.id);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(
      `After the generated registration for '${gameId}' game_types is ${JSON.stringify(ids)}, expected ${JSON.stringify(expected)}.`,
    );
  }
  if (wordCategories !== null) {
    const rows = database
      .prepare('SELECT id, name FROM word_categories WHERE game = ? ORDER BY sort_order')
      .all(gameId)
      .map((row) => ({ id: row.id, name: row.name }));
    const want = wordCategories.map((entry) => ({ id: entry.id, name: entry.name }));
    if (JSON.stringify(rows) !== JSON.stringify(want)) {
      throw new Error(
        `After the generated registration word_categories of '${gameId}' are ${JSON.stringify(rows)}, expected ${JSON.stringify(want)}.`,
      );
    }
  }
  if (includeStatsTable && tableColumns(database, `${gameId}_user_stats`).length === 0) {
    throw new Error(
      `After the generated registration for '${gameId}' table ${gameId}_user_stats is missing.`,
    );
  }
  const violations = database.prepare('PRAGMA foreign_key_check').all();
  if (violations.length > 0) {
    throw new Error(
      `After the generated registration for '${gameId}' PRAGMA foreign_key_check reports ${JSON.stringify(violations)}.`,
    );
  }
}

/**
 * Judge the current schema and return the registration SQL, or throw with
 * every problem that makes an inserts-only registration wrong.
 */
export function planRegistrationMigration({
  migrationsDir,
  gameId,
  displayName,
  codeGameTypes,
  includeStatsTable,
  wordCategories,
}) {
  const options = { gameId, codeGameTypes, includeStatsTable, wordCategories };
  const database = replayMigrations(migrationsDir);
  try {
    const problems = registrationPreflightProblems(database, options);
    if (problems.length > 0) {
      throw new Error(
        `Registration migration for '${gameId}' cannot be generated against the current schema:\n  - ${problems.join('\n  - ')}\n  ${HAND_WRITTEN_GUIDANCE}`,
      );
    }
    const sql = buildRegistrationSql({ gameId, displayName, includeStatsTable, wordCategories });
    verifyAppliedRegistration(database, sql, options);
    return sql;
  } finally {
    database.close();
  }
}
