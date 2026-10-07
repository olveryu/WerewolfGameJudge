/** Migration 0064: registers 'avalon' in every game_type CHECK without losing room data. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const EXISTING_GAME_TYPES = [
  'werewolf',
  'pictionary',
  'fibking',
  'undercover',
  'storyrelay',
  'drawguess',
] as const;

async function seedExistingRooms() {
  await env.DB.prepare("INSERT INTO users (id) VALUES ('avalon-migration-user')").run();
  for (const [index, gameType] of EXISTING_GAME_TYPES.entries()) {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at, games_started, last_started_at)
         VALUES (?, ?, ?, 'avalon-migration-user', ?, '{"retained":true}', 'active', '2026-09-01', '2026-09-02', 7, '2026-09-02')`,
      ).bind(gameType, String(8200 + index), gameType, `creation-${gameType}`),
      env.DB.prepare(
        "INSERT INTO room_participants (room_id, user_id, joined_at) VALUES (?, 'avalon-migration-user', '2026-09-01')",
      ).bind(gameType),
      env.DB.prepare(
        "INSERT INTO room_game_starts (effect_id, room_id, started_revision, started_at) VALUES (?, ?, 42, '2026-09-02')",
      ).bind(`effect-${gameType}`, gameType),
    ]);
  }
  await env.DB.prepare(
    `INSERT INTO fib_round_word_selections (room_id, room_creation_id, effect_id, round_id, request_fingerprint, word_id, word, core_meaning, usage_note, source, selection_tier, selected_at, sequence_number, participant_user_ids)
     VALUES ('fibking', 'creation-fibking', 'selection-effect', 'round-1', 'fingerprint', NULL, '旧词', '原含义', '原说明', 'local', 'local_fallback', '2026-09-01', 123, '["avalon-migration-user"]')`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
     VALUES ('retained-pair', 'apple', 'pear', 'food', 'active', '2026-09-01', '2026-09-01', '{}')`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO undercover_round_word_selections (room_id, room_creation_id, round_id, request_fingerprint, word_pair_id, word_a, word_b, category, selected_at)
     VALUES ('undercover', 'creation-undercover', 'old-round', 'old-fingerprint', 'retained-pair', 'apple', 'pear', 'food', '2026-09-01')`,
  ).run();
}

describe('Avalon game_type migration', () => {
  it('applies 0064 preserving every existing room and child record, then accepts avalon', async () => {
    await seedExistingRooms();
    const readTables = () =>
      Promise.all(
        [
          'rooms',
          'room_participants',
          'room_game_starts',
          'fib_round_word_selections',
          'undercover_round_word_selections',
        ].map(
          async (table) =>
            (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results,
        ),
      );
    const before = await readTables();
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0064_avalon.sql');
    if (migration === undefined) throw new Error('Avalon migration 0064 is missing');
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    expect(await readTables()).toEqual(before);
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);

    await env.DB.prepare(
      `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
       VALUES ('avalon-room', '4321', 'avalon', 'avalon-migration-user', 'creation-avalon', '{}', 'active', '2026-10-07', '2026-10-07')`,
    ).run();
    await expect(
      env.DB.prepare(
        `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
         VALUES ('bogus-room', '4322', 'not-a-game', 'avalon-migration-user', 'creation-bogus', '{}', 'active', '2026-10-07', '2026-10-07')`,
      ).run(),
    ).rejects.toThrow();
    await env.DB.prepare("DELETE FROM rooms WHERE id = 'avalon-room'").run();
  });
});
