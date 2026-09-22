/** The room constraint expansion must preserve existing games and every room-owned child. */
import { UNDERCOVER_STATE_CODEC } from '@game-judge/game-engine/games/undercover/public';
import { env, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';

afterEach(deleteCurrentRoomAlarms);

describe('Undercover room migration', () => {
  it('restores a v1 room and replays its migrated receipt without changing room identity or seats', async () => {
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
    const identity = { roomId: stub.id.toString(), roomCode: '8199', creationId: 'undercover-v1' };
    const config = { numberOfPlayers: 4, hasBlank: false, category: 'all' };
    await env.DB.prepare("INSERT INTO users (id) VALUES ('undercover-migration-host')").run();
    await env.DB.prepare(
      `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
       VALUES (?, ?, 'undercover', 'undercover-migration-host', ?, ?, 'active', '2026-09-21', '2026-09-21')`,
    )
      .bind(
        identity.roomId,
        identity.roomCode,
        identity.creationId,
        JSON.stringify({ ...config, isTestMode: true }),
      )
      .run();
    expect(
      await stub.initializeRoom({
        ...identity,
        gameType: 'undercover',
        hostUserId: 'undercover-migration-host',
        config,
      }),
    ).toMatchObject({ success: true });
    const commandContext = {
      ...identity,
      actorUserId: 'undercover-migration-host',
      controlledSeat: null,
    };
    expect(
      await stub.dispatchUserCommand({
        ...commandContext,
        commandId: 'seat-host',
        command: { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
      }),
    ).toMatchObject({ kind: 'decided', result: { kind: 'committed' } });
    const fillCommand = {
      ...commandContext,
      commandId: 'fill-bots',
      command: { type: 'room.seat.fillBots' },
    };
    const filled = await stub.dispatchUserCommand(fillCommand);
    if (filled.kind !== 'decided' || filled.result.kind !== 'committed')
      throw new Error('Expected filled room');
    const expectedSnapshot = filled.result.snapshot;
    await runInDurableObject(stub, async (instance: GameRoomRuntime, durableState) => {
      const sql = durableState.storage.sql;
      sql.exec(`UPDATE room_state SET state_version = 1,
        game_state = json_set(game_state, '$.stateVersion', 1, '$.config.isTestMode', json('true')),
        initialization_json = json_set(initialization_json, '$.config.isTestMode', json('true'))`);
      sql.exec(`UPDATE command_receipts SET state_version = 1,
        result_json = json_set(result_json, '$.snapshot.stateVersion', 1,
          '$.snapshot.state.stateVersion', 1, '$.snapshot.state.config.isTestMode', json('true'))`);
      const before = sql.exec('SELECT * FROM room_state').one();
      const receipts = sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray();
      expect(await instance.getSnapshot(identity)).toEqual(expectedSnapshot);
      expect(sql.exec('SELECT * FROM room_state').one()).toEqual({
        ...before,
        state_version: UNDERCOVER_STATE_CODEC.stateVersion,
        game_state: expect.any(String) as unknown,
      });
      expect(sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray()).toEqual(
        receipts.map((receipt) => ({
          ...receipt,
          state_version: UNDERCOVER_STATE_CODEC.stateVersion,
          result_json: expect.any(String) as unknown,
        })),
      );
      expect(await instance.dispatchUserCommand(fillCommand)).toMatchObject({
        kind: 'decided',
        isReplay: true,
        result: { kind: 'committed', snapshot: expectedSnapshot },
      });
    });
    expect(
      await stub.dispatchUserCommand({
        ...commandContext,
        commandId: 'clear-bots',
        command: { type: 'undercover.bots.clear' },
      }),
    ).toMatchObject({
      kind: 'decided',
      result: {
        kind: 'committed',
        snapshot: {
          state: {
            botSeats: [],
            realSeats: UNDERCOVER_STATE_CODEC.parse(expectedSnapshot.state).realSeats,
          },
        },
      },
    });
  });

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
