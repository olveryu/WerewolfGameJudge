import {
  FIB_STATE_CODEC,
  FIB_STATE_VERSION,
  type FibPublicCommand,
  isFibImplicitBotSeat,
} from '@game-judge/game-engine/games/fibking/public';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';

const ROOM_CODE = '8642';

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
  target: Pick<GameRoom, 'dispatchUserCommand'>,
  stub: DurableObjectStub<GameRoom>,
  commandId: string,
  command: FibPublicCommand,
): Promise<DispatchRoomResult> {
  return target.dispatchUserCommand({
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
      stateVersion: FIB_STATE_VERSION,
      phase: 'lobby',
      numberOfPlayers: 8,
      realSeats: {},
      fillEmptySeatsWithBots: false,
      excludedBotSeats: [],
    });
    expect(result.snapshot.revision).toBe(1);
  });

  it('persists a single implicit-bot kick without removing the other bots', async () => {
    const stub = getStub();
    await initialize(stub);

    const filled = requireCommitted(
      await dispatch(stub, stub, 'fib-fill-bots-for-kick', { type: 'room.seat.fillBots' }),
    );
    expect(isFibImplicitBotSeat(filled.snapshot.state, 4)).toBe(true);
    expect(isFibImplicitBotSeat(filled.snapshot.state, 5)).toBe(true);

    const kicked = requireCommitted(
      await dispatch(stub, stub, 'fib-kick-bot-4', { type: 'room.seat.kick', seat: 4 }),
    );
    expect(kicked.snapshot.state.excludedBotSeats).toEqual([4]);
    expect(isFibImplicitBotSeat(kicked.snapshot.state, 4)).toBe(false);
    expect(isFibImplicitBotSeat(kicked.snapshot.state, 5)).toBe(true);

    const refilled = requireCommitted(
      await dispatch(stub, stub, 'fib-refill-bot-4', { type: 'room.seat.fillBots' }),
    );
    expect(refilled.snapshot.state.excludedBotSeats).toEqual([]);
    expect(isFibImplicitBotSeat(refilled.snapshot.state, 4)).toBe(true);
  });

  it('recovers an interrupted word effect and completes the round through generic alarm dispatch', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      requireCommitted(
        await dispatch(instance, stub, 'fib-seat-host', {
          type: 'room.seat.take',
          seat: 0,
          profile: { displayName: '房主' },
        }),
      );
      requireCommitted(
        await dispatch(instance, stub, 'fib-fill-bots', { type: 'room.seat.fillBots' }),
      );
      const preparing = requireCommitted(
        await dispatch(instance, stub, 'fib-start-round', { type: 'fib.round.start' }),
      );
      expect(preparing.snapshot.state.phase).toBe('preparing');
      expect(Object.keys(preparing.snapshot.state.realSeats)).toEqual(['0']);

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
      `SELECT round_id, word, core_meaning, usage_note, source
      FROM fib_word_generation_results WHERE room_id = ?`,
    )
      .bind(stub.id.toString())
      .first();
    expect(generated).toEqual({
      round_id: ongoing.round.roundId,
      word: ongoing.round.word,
      core_meaning: ongoing.round.definition.coreMeaning,
      usage_note: ongoing.round.definition.usageNote,
      source: ongoing.round.source,
    });
  });
});
