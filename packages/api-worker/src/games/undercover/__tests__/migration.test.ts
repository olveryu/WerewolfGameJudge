/** The room constraint expansion must preserve existing games and every room-owned child. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('Undercover room migration', () => {
  it('preserves all existing room types, participation, starts and Fib selection snapshots', async () => {
    await env.DB.batch([
      env.DB.prepare('DROP TABLE undercover_round_word_selections'),
      env.DB.prepare('DROP TABLE undercover_word_pairs'),
      env.DB.prepare(
        "INSERT INTO users (id, created_at, updated_at) VALUES ('migration-user', '2026-09-01', '2026-09-02')",
      ),
    ]);
    for (const [index, gameType] of ['werewolf', 'pictionary', 'fibking'].entries()) {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at, games_started, last_started_at)
          VALUES (?, ?, ?, 'migration-user', ?, '{"retained":true}', 'active', '2026-09-01', '2026-09-02', 7, '2026-09-02')`,
        ).bind(gameType, String(8000 + index), gameType, `creation-${gameType}`),
        env.DB.prepare(
          "INSERT INTO room_participants (room_id, user_id, joined_at) VALUES (?, 'migration-user', '2026-09-01')",
        ).bind(gameType),
        env.DB.prepare(
          "INSERT INTO room_game_starts (effect_id, room_id, started_revision, started_at) VALUES (?, ?, 42, '2026-09-02')",
        ).bind(`effect-${gameType}`, gameType),
      ]);
    }
    await env.DB.prepare(
      `INSERT INTO fib_round_word_selections (room_id, room_creation_id, effect_id, round_id, request_fingerprint, word_id,
      word, core_meaning, usage_note, source, selection_tier, selected_at, sequence_number, participant_user_ids)
      VALUES ('fibking', 'creation-fibking', 'selection-effect', 'round-1', 'fingerprint', NULL, '旧词', '原含义', '原说明', 'local', 'local_fallback', '2026-09-01', 123, '["migration-user"]')`,
    ).run();
    const tables = [
      'rooms',
      'room_participants',
      'room_game_starts',
      'fib_round_word_selections',
    ] as const;
    const before = await Promise.all(
      tables.map(
        async (table) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results,
      ),
    );
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0056_undercover.sql');
    if (migration === undefined) throw new Error('Undercover migration is missing');
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    const after = await Promise.all(
      tables.map(
        async (table) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results,
      ),
    );
    expect(after).toEqual(before);
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    await env.DB.prepare("DELETE FROM rooms WHERE id = 'fibking'").run();
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fib_round_word_selections WHERE room_id = 'fibking'",
      ).first(),
    ).toEqual({ count: 0 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM room_participants').first()).toEqual(
      { count: 2 },
    );
  });
});
