import { FIB_STATE_CODEC, type FibPublicCommand } from '@werewolf/game-engine/games/fibking/public';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoomRuntime as GameRoom } from '../platform/room/GameRoom';
import type { DispatchRoomResult, InitializeRoomResult } from '../platform/room/types';
import { deleteCurrentRoomAlarms } from './roomTestCleanup';
import { bootstrapTestSchema } from './testSchemaBootstrap';

const ROOM_CODE = '8642';

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id = 'fib-host'").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('fib-host')").run();
});

afterEach(deleteCurrentRoomAlarms);

function getStub(): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
}

function roomIdentity(stub: DurableObjectStub<GameRoom>) {
  return { roomCode: ROOM_CODE, roomId: stub.id.toString(), creationId: 'fib-creation-1' };
}

async function ensureDirectory(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'fibking', 'fib-host', 'fib-creation-1',
      '{"numberOfPlayers":8}', 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`,
  )
    .bind(stub.id.toString(), ROOM_CODE)
    .run();
}

async function initialize(stub: DurableObjectStub<GameRoom>): Promise<InitializeRoomResult> {
  await ensureDirectory(stub);
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'fibking',
    hostUserId: 'fib-host',
    config: { numberOfPlayers: 8 },
  });
}

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  commandId: string,
  command: FibPublicCommand,
): Promise<DispatchRoomResult> {
  return stub.dispatchUserCommand({
    ...roomIdentity(stub),
    commandId,
    actorUserId: 'fib-host',
    controlledSeat: null,
    command,
  });
}

function requireCommitted(result: DispatchRoomResult) {
  if (result.kind !== 'decided') throw new Error(result.reason);
  if (result.result.kind !== 'committed') throw new Error(result.result.reason);
  return {
    ...result.result,
    snapshot: {
      ...result.result.snapshot,
      state: FIB_STATE_CODEC.parse(result.result.snapshot.state),
    },
  };
}

describe('FibKing generic GameRoom integration', () => {
  it('creates sparse authoritative state through the registered Worker module', async () => {
    const stub = getStub();
    const result = await initialize(stub);
    if (!result.success) throw new Error(result.reason);
    const state = FIB_STATE_CODEC.parse(result.snapshot.state);

    expect(state).toMatchObject({
      gameType: 'fibking',
      phase: 'lobby',
      numberOfPlayers: 8,
      realSeats: {},
      fillEmptySeatsWithBots: false,
    });
    expect(result.snapshot.revision).toBe(1);
  });

  it('recovers an interrupted word effect and completes the round through generic alarm dispatch', async () => {
    const stub = getStub();
    await initialize(stub);
    requireCommitted(
      await dispatch(stub, 'fib-seat-host', {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      }),
    );
    requireCommitted(await dispatch(stub, 'fib-fill-bots', { type: 'room.seat.fillBots' }));
    const preparing = requireCommitted(
      await dispatch(stub, 'fib-start-round', { type: 'fib.round.start' }),
    );
    expect(preparing.snapshot.state.phase).toBe('preparing');
    expect(Object.keys(preparing.snapshot.state.realSeats)).toEqual(['0']);

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      const wordEffect = state.storage.sql
        .exec<{ id: string; effect_type: string; business_key: string; status: string }>(
          `SELECT id, effect_type, business_key, status
          FROM effect_outbox WHERE effect_type = 'fib.word.generate'`,
        )
        .one();
      expect(wordEffect).toMatchObject({
        effect_type: 'fib.word.generate',
        business_key: 'fib-round:fib-start-round',
        status: 'pending',
      });

      state.storage.sql.exec(
        `UPDATE effect_outbox
        SET attempt_count = 1, available_at = 0
        WHERE id = ?`,
        wordEffect.id,
      );
      await state.storage.deleteAlarm();
    });

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      await instance.alarm();
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM effect_outbox').one()).toEqual({
        count: 0,
      });
    });

    const snapshot = await stub.getSnapshot(roomIdentity(stub));
    if (snapshot === null) throw new Error('Expected Fib snapshot after alarm recovery');
    const ongoing = FIB_STATE_CODEC.parse(snapshot.state);
    expect(ongoing.phase).toBe('ongoing');
    if (ongoing.phase !== 'ongoing') throw new Error('Expected ongoing Fib state');
    expect(ongoing.round.source).toBe('local');
    expect(ongoing.round.roles.guesserSeat).not.toBe(ongoing.round.roles.honestSeat);
    expect(ongoing.usedWords).toEqual([ongoing.round.word]);
    expect(Object.keys(ongoing.realSeats)).toEqual(['0']);

    const room = await env.DB.prepare('SELECT games_started FROM rooms WHERE id = ?')
      .bind(stub.id.toString())
      .first();
    expect(room).toEqual({ games_started: 1 });
    const generated = await env.DB.prepare(
      `SELECT round_id, word, definition, source
      FROM fib_word_generation_results WHERE room_id = ?`,
    )
      .bind(stub.id.toString())
      .first();
    expect(generated).toEqual({
      round_id: ongoing.round.roundId,
      word: ongoing.round.word,
      definition: ongoing.round.definition,
      source: ongoing.round.source,
    });
  });
});
