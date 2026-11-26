import { DatabaseSync } from 'node:sqlite';

import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import { FIBKING_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/fibking/public';
import { UNDERCOVER_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/undercover/public';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrationsThrough, latestMigrationName } from './support/d1Migrations';

/**
 * Code is the single authority for the game list and the word categories; the D1 lookup tables
 * game_types / word_games / word_categories are its projection. A constant added in code without
 * the matching INSERT migration (or the reverse) fails here.
 */
const CATEGORY_CATALOGS = [
  FIBKING_WORD_CATEGORY_CATALOG,
  UNDERCOVER_WORD_CATEGORY_CATALOG,
  DRAWGUESS_WORD_CATEGORY_CATALOG,
  DECRYPTO_WORD_CATEGORY_CATALOG,
];

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

  it('keeps categories that words still reference', () => {
    const [category] = DECRYPTO_WORD_CATEGORY_CATALOG.ids;
    database.exec(
      `INSERT INTO decrypto_words (id, word, category, status, created_at) VALUES ('w1', '探针', '${category}', 'active', 'now')`,
    );
    expectRejected(`DELETE FROM word_categories WHERE game = 'decrypto' AND id = '${category}'`);
  });
});
