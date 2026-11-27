import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/undercover/public';
import { WORD_CATEGORY_CATALOGS } from '@game-judge/game-engine/games/wordCategoryCatalogs';
import {
  isWellFormedCatalogName,
  isWellFormedGameId,
  isWellFormedWordCategoryId,
} from '@game-judge/game-engine/platform/protocol/catalogIds';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrationsThrough, latestMigrationName } from './support/d1Migrations';

/**
 * Code is the single authority for the game list and the word categories; the D1 lookup tables
 * game_types / word_games / word_categories are its projection. A constant added in code without
 * the matching INSERT migration (or the reverse) fails here.
 */
const CATEGORY_CATALOGS = Object.values(WORD_CATEGORY_CATALOGS);

let database: DatabaseSync;

beforeEach(() => {
  database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  applyMigrationsThrough(database, latestMigrationName());
});

afterEach(() => {
  database.close();
});

function column(sql: string, ...params: string[]): unknown[] {
  return database
    .prepare(sql)
    .all(...params)
    .map((row) => Object.values(row)[0]);
}

function expectRejected(sql: string): void {
  expect(() => database.exec(sql)).toThrow(
    /FOREIGN KEY constraint failed|NOT NULL constraint failed/,
  );
}

describe('D1 catalog projection', () => {
  it('game_types rows equal GAME_TYPES in order', () => {
    expect(column('SELECT id FROM game_types ORDER BY sort_order')).toEqual([...GAME_TYPES]);
    expect(column('SELECT sort_order FROM game_types ORDER BY sort_order')).toEqual(
      GAME_TYPES.map((_, index) => index),
    );
  });

  it('word_games rows equal GAME_WORD_GAMES', () => {
    expect(column('SELECT game FROM word_games ORDER BY game')).toEqual(
      [...GAME_WORD_GAMES].sort(),
    );
    expect(CATEGORY_CATALOGS.map((catalog) => catalog.game).sort()).toEqual(
      [...GAME_WORD_GAMES].sort(),
    );
  });

  it('word_categories rows equal each engine category catalog', () => {
    for (const catalog of CATEGORY_CATALOGS) {
      const rows = database
        .prepare('SELECT id, name FROM word_categories WHERE game = ? ORDER BY sort_order')
        .all(catalog.game)
        .map((row) => ({ id: row.id, name: row.name }));
      expect(rows, catalog.game).toEqual(
        catalog.entries.map((entry) => ({ id: entry.id, name: entry.name })),
      );
      expect(
        column(
          'SELECT sort_order FROM word_categories WHERE game = ? ORDER BY sort_order',
          catalog.game,
        ),
      ).toEqual(catalog.entries.map((_, index) => index));
    }
  });

  it('undercover draw partitions project the undercover categories', () => {
    expect(
      column(
        "SELECT partition_key FROM word_draw_index WHERE pool = 'undercover' ORDER BY partition_key",
      ),
    ).toEqual(['all', ...UNDERCOVER_WORD_CATEGORY_CATALOG.ids].sort());
    database.exec(
      "INSERT INTO word_categories (game, id, name, sort_order) VALUES ('undercover', 'zzprobe', '探针', 999)",
    );
    expect(
      column(
        "SELECT members FROM word_draw_index WHERE pool = 'undercover' AND partition_key = 'zzprobe'",
      ),
    ).toEqual([',']);
    database.exec("DELETE FROM word_categories WHERE game = 'undercover' AND id = 'zzprobe'");
    expect(
      column(
        "SELECT COUNT(*) FROM word_draw_index WHERE pool = 'undercover' AND partition_key = 'zzprobe'",
      ),
    ).toEqual([0]);
  });

  it('rejects unregistered games and foreign categories', () => {
    database.exec(`
      INSERT INTO users (id) VALUES ('probe-user');
    `);
    expectRejected(`
      INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
      VALUES ('r', '1234', 'nosuchgame', 'probe-user', 'c', '{}', 'active', 'now', 'now')`);
    expectRejected(
      "INSERT INTO word_seen (user_id, pool, seen) VALUES ('probe-user', 'werewolf', ',')",
    );
    expectRejected(
      "INSERT INTO word_categories (game, id, name, sort_order) VALUES ('werewolf', 'probe', '探针', 0)",
    );
    expectRejected(
      "INSERT INTO decrypto_words (id, word, category, status, created_at) VALUES ('w1', '探针', 'customs', 'active', 'now')",
    );
    expectRejected(
      "INSERT INTO decrypto_words (id, word, category, status, created_at) VALUES ('w2', '探针二', 'nosuch', 'active', 'now')",
    );
    expectRejected(
      "INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, created_at, activated_at) VALUES ('f1', '探针', 'm', 'u', NULL, 'local', 'active', 0, 'now', 'now')",
    );
  });

  it('accepts all 40 canonical decrypto categories and rejects unregistered ones in words and packs', () => {
    const word =
      database.prepare(`INSERT INTO decrypto_words (id, word, category, status, created_at)
      VALUES (?, ?, ?, 'active', 'now')`);
    const pack = database.prepare(`INSERT INTO decrypto_word_packs
      (id, category, request_token, status, model, prompt_version, review_version, created_at)
      VALUES (?, ?, 'request', 'reserved', 'model', 'prompt', 'review', 'now')`);
    expect(DECRYPTO_WORD_CATEGORY_CATALOG.ids).toHaveLength(40);
    for (const [index, category] of DECRYPTO_WORD_CATEGORY_CATALOG.ids.entries()) {
      word.run(`category-${category}`, `分类词${index}`, category);
      pack.run(`pack-${category}`, category);
    }
    for (const invalid of ['general', 'unknown']) {
      expect(() => word.run(`invalid-${invalid}`, `无效词${invalid}`, invalid)).toThrow(
        /FOREIGN KEY constraint failed/,
      );
      expect(() => pack.run(`invalid-${invalid}`, invalid)).toThrow(
        /FOREIGN KEY constraint failed/,
      );
    }
  });

  it('E2E D1 fixtures load on the full migration chain without foreign-key violations', () => {
    // Fixtures must carry catalog ids, not display labels: before 0095/0096 the word tables had no
    // category CHECK, so fib 'literary' and the drawguess Chinese labels loaded fine and only the
    // new (game, category) foreign key exposed them. Same order as scripts/setup-e2e-api.mjs
    // (fib → undercover → drawguess); alphabetical order would be drawguess → fib → undercover.
    const fixtures = [
      'e2e/fixtures/fib-word-pool.sql',
      'e2e/fixtures/undercover-word-pool.sql',
      'e2e/fixtures/drawguess-word-pool.sql',
    ] as const;
    expect(
      readdirSync('e2e/fixtures')
        .filter((name) => name.endsWith('.sql'))
        .map((name) => `e2e/fixtures/${name}`)
        .sort(),
    ).toEqual([...fixtures].sort());
    for (const fixture of fixtures) {
      try {
        database.exec(readFileSync(fixture, 'utf8'));
      } catch (error) {
        throw new Error(`E2E fixture ${fixture} failed on ${latestMigrationName()}`, {
          cause: error,
        });
      }
    }
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('keeps categories that words still reference', () => {
    const [category] = DECRYPTO_WORD_CATEGORY_CATALOG.ids;
    database.exec(
      `INSERT INTO decrypto_words (id, word, category, status, created_at) VALUES ('w1', '探针', '${category}', 'active', 'now')`,
    );
    expectRejected(`DELETE FROM word_categories WHERE game = 'decrypto' AND id = '${category}'`);
  });

  describe('key shapes: the 0095 CHECKs accept exactly what catalogIds.ts accepts', () => {
    const CHECK_FAILED = /CHECK constraint failed/;

    /** True when the row is stored; the row is removed again so probes never collide. */
    function stored(insert: () => void, remove: () => void): boolean {
      try {
        insert();
      } catch (error) {
        if (error instanceof Error && CHECK_FAILED.test(error.message)) return false;
        throw error;
      }
      remove();
      return true;
    }

    let insertGame: StatementSync;
    let deleteGame: StatementSync;
    let insertCategory: StatementSync;
    let deleteCategories: StatementSync;

    // A probe word game of its own, so no probe name meets a shipped name's UNIQUE (game, name).
    beforeEach(() => {
      database.exec(`
        INSERT INTO game_types (id, sort_order) VALUES ('zzprobe', 999);
        INSERT INTO word_games (game) VALUES ('zzprobe');
      `);
      insertGame = database.prepare('INSERT INTO game_types (id, sort_order) VALUES (?, 1000)');
      deleteGame = database.prepare('DELETE FROM game_types WHERE sort_order = 1000');
      insertCategory = database.prepare(
        "INSERT INTO word_categories (game, id, name, sort_order) VALUES ('zzprobe', ?, ?, 0)",
      );
      deleteCategories = database.prepare("DELETE FROM word_categories WHERE game = 'zzprobe'");
    });

    function gameIdStored(id: string): boolean {
      return stored(
        () => insertGame.run(id),
        () => deleteGame.run(),
      );
    }

    function categoryStored(id: string, name: string): boolean {
      return stored(
        () => insertCategory.run(id, name),
        () => deleteCategories.run(),
      );
    }

    // Every BMP code point except lone surrogates: they are not text, and what reaches the CHECK
    // depends on the driver (node:sqlite substitutes U+FFFD); the code rule rejects them (below).
    const BMP = Array.from({ length: 0x10000 }, (_, codePoint) => codePoint)
      .filter((codePoint) => codePoint < 0xd800 || codePoint > 0xdfff)
      .map((codePoint) => String.fromCharCode(codePoint));
    const ASTRAL = ['\u{1F600}', '\u{20000}'];
    // ~130k-260k real inserts per sweep: seconds, not the default 5 s budget on a loaded runner.
    const SWEEP_TIMEOUT_MS = 60_000;

    it('a lone surrogate is rejected by the code rule because it does not round-trip', () => {
      const readName = database.prepare(
        "SELECT name FROM word_categories WHERE game = 'zzprobe' AND id = 'probe'",
      );
      for (const name of ['\ud800', '名\udfff', '\udc00名']) {
        expect(isWellFormedCatalogName(name)).toBe(false);
        insertCategory.run('probe', name);
        expect(readName.get()).not.toEqual({ name });
        deleteCategories.run();
      }
      for (const name of ['\u{1F600}名', '\u{20000}']) {
        expect(isWellFormedCatalogName(name)).toBe(true);
        insertCategory.run('probe', name);
        expect(readName.get()).toEqual({ name });
        deleteCategories.run();
      }
    });

    it('every shipped id and name satisfies the code rule', () => {
      expect(GAME_TYPES.filter((id) => !isWellFormedGameId(id))).toEqual([]);
      for (const catalog of CATEGORY_CATALOGS) {
        expect(
          catalog.entries.filter(
            (entry) =>
              !isWellFormedWordCategoryId(entry.id) || !isWellFormedCatalogName(entry.name),
          ),
          catalog.game,
        ).toEqual([]);
      }
    });

    it(
      'game ids: one character at the head, inside or at the end, and the length bounds',
      () => {
        database.exec('BEGIN');
        const disagreements: string[] = [];
        for (const character of [...BMP, ...ASTRAL]) {
          for (const id of [`${character}ab`, `a${character}b`, `ab${character}`]) {
            if (gameIdStored(id) !== isWellFormedGameId(id)) disagreements.push(JSON.stringify(id));
          }
        }
        for (const id of [
          '',
          'a',
          'ab',
          `a${'b'.repeat(31)}`,
          `a${'b'.repeat(32)}`,
          'a\u0000b',
          'ab\u0000cd',
          'ab\u0000!!',
        ]) {
          if (gameIdStored(id) !== isWellFormedGameId(id)) disagreements.push(JSON.stringify(id));
        }
        database.exec('ROLLBACK');
        expect(disagreements).toEqual([]);
      },
      SWEEP_TIMEOUT_MS,
    );

    it(
      'category ids: one character at the head, inside or at the end, and the length bounds',
      () => {
        database.exec('BEGIN');
        const disagreements: string[] = [];
        for (const character of [...BMP, ...ASTRAL]) {
          for (const id of [`${character}ab`, `a${character}b`, `ab${character}`]) {
            if (categoryStored(id, '探针') !== isWellFormedWordCategoryId(id)) {
              disagreements.push(JSON.stringify(id));
            }
          }
        }
        for (const id of [
          '',
          'a',
          'aB',
          `a${'b'.repeat(39)}`,
          `a${'b'.repeat(40)}`,
          'a\u0000b',
          'ab\u0000cd',
          'ab\u0000!!',
        ]) {
          if (categoryStored(id, '探针') !== isWellFormedWordCategoryId(id)) {
            disagreements.push(JSON.stringify(id));
          }
        }
        database.exec('ROLLBACK');
        expect(disagreements).toEqual([]);
      },
      SWEEP_TIMEOUT_MS,
    );

    it(
      'category names: one character alone, leading, trailing or inside',
      () => {
        database.exec('BEGIN');
        const disagreements: string[] = [];
        for (const character of [...BMP, ...ASTRAL]) {
          for (const name of [character, `${character}名`, `名${character}`, `名${character}字`]) {
            if (categoryStored('probe', name) !== isWellFormedCatalogName(name)) {
              disagreements.push(JSON.stringify(name));
            }
          }
        }
        if (categoryStored('probe', '') !== isWellFormedCatalogName('')) disagreements.push('""');
        database.exec('ROLLBACK');
        expect(disagreements).toEqual([]);
      },
      SWEEP_TIMEOUT_MS,
    );

    it('stores keys only as text', () => {
      expect(() =>
        database.exec("INSERT INTO game_types (id, sort_order) VALUES (CAST('ab' AS BLOB), 1000)"),
      ).toThrow(CHECK_FAILED);
      expect(() =>
        database.exec(
          "INSERT INTO word_categories (game, id, name, sort_order) VALUES ('zzprobe', CAST('ab' AS BLOB), '探针', 0)",
        ),
      ).toThrow(CHECK_FAILED);
      expect(() =>
        database.exec(
          "INSERT INTO word_categories (game, id, name, sort_order) VALUES ('zzprobe', 'ab', CAST('探针' AS BLOB), 0)",
        ),
      ).toThrow(CHECK_FAILED);
    });
  });
});
