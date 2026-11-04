/**
 * Pictionary scheduled settlement, end to end through the real
 * Durable Object: arming an answering deadline parks a
 * `pictionary.settle.due` row in the effect outbox with
 * `available_at` at the deadline and the room alarm set to it;
 * when the alarm fires, the effect settles the phase through the
 * internal system command — no client needs to submit an expire.
 * A delivery whose pinned arming is gone is a no-op.
 */

import {
  PICTIONARY_STATE_CODEC,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';
import { pictionaryEffectSchema, pictionaryInternalCommandSchema } from '../schemas';

const ROOM_CODE = '2468';
const HOST = 'pict-host';
const CONFIG = {
  numberOfPlayers: 4,
  drawingDurationSeconds: 120,
  guessDurationSeconds: 45,
  transitionDurationSeconds: 5,
  galleryItemDurationSeconds: 5,
} as const;
const seatUser = (seat: number) => (seat === 0 ? HOST : `u${seat}`);

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN ('pict-host', 'u1', 'u2', 'u3')").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('pict-host'), ('u1'), ('u2'), ('u3')").run();
});

afterEach(deleteCurrentRoomAlarms);

function getStub(): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
}

function roomIdentity(stub: DurableObjectStub<GameRoom>) {
  return { roomCode: ROOM_CODE, roomId: stub.id.toString(), creationId: 'creation-1' };
}

async function initialize(stub: DurableObjectStub<GameRoom>): Promise<InitializeRoomResult> {
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'pictionary', 'pict-host', 'creation-1',
      ?, 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)
    ON CONFLICT DO NOTHING`,
  )
    .bind(stub.id.toString(), ROOM_CODE, canonicalJson(CONFIG))
    .run();
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'pictionary',
    hostUserId: HOST,
    config: CONFIG,
  });
}

let commandSeq = 0;

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  actorUserId: string,
  command: PictionaryPublicCommand,
): Promise<DispatchRoomResult> {
  commandSeq += 1;
  return stub.dispatchUserCommand({
    ...roomIdentity(stub),
    commandId: `cmd-${commandSeq}`,
    actorUserId,
    controlledSeat: null,
    command,
  });
}

function requireCommitted(result: DispatchRoomResult): void {
  if (result.kind !== 'decided') {
    throw new Error(`Expected decided command, received ${result.reason}`);
  }
  if (result.result.kind !== 'committed') {
    throw new Error(`Expected committed command, received ${result.result.reason}`);
  }
  if (result.result.outcome.kind !== 'success') {
    throw new Error(`Expected success outcome, received ${result.result.outcome.reason}`);
  }
}

async function send(
  stub: DurableObjectStub<GameRoom>,
  actorUserId: string,
  command: PictionaryPublicCommand,
): Promise<void> {
  requireCommitted(await dispatch(stub, actorUserId, command));
}

async function readState(stub: DurableObjectStub<GameRoom>): Promise<PictionaryState> {
  const snapshot = await stub.getSnapshot(roomIdentity(stub));
  if (snapshot === null) throw new Error('Expected a room snapshot');
  return PICTIONARY_STATE_CODEC.parse(snapshot.state);
}

/** Four seated humans driven to an armed answering deadline. */
async function armedAnsweringRoom(stub: DurableObjectStub<GameRoom>): Promise<PictionaryState> {
  await initialize(stub);
  for (let seat = 0; seat < 4; seat += 1) {
    await send(stub, seatUser(seat), {
      type: 'room.seat.take',
      seat,
      profile: { displayName: `P${seat}` },
    });
  }
  await send(stub, HOST, { type: 'pictionary.game.begin' });
  const state = await readState(stub);
  if (state.phase !== 'answering' || state.deadlineAt === null || state.roundId === null) {
    throw new Error('Expected an armed answering phase');
  }
  return state;
}

interface SettleRow {
  readonly business_key: string;
  readonly available_at: number;
  readonly status: string;
  readonly payload_json: string;
}

async function readSettleRow(stub: DurableObjectStub<GameRoom>): Promise<SettleRow | null> {
  let row: SettleRow | null = null;
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    const rows = state.storage.sql
      .exec(
        `SELECT business_key, available_at, status, payload_json FROM effect_outbox
         WHERE effect_type = 'pictionary.settle.due'`,
      )
      .toArray();
    row = rows.length === 0 ? null : (rows[0] as unknown as SettleRow);
  });
  return row;
}

async function readAlarm(stub: DurableObjectStub<GameRoom>): Promise<number | null> {
  let alarm: number | null = null;
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    alarm = await state.storage.getAlarm();
  });
  return alarm;
}

/**
 * Moves one armed deadline into the past: the persisted phase
 * deadline, the outbox row's delivery time, and the deadline pinned
 * inside the effect payload all shift together, exactly as time
 * passing would leave them — only the wall clock differs.
 */
async function fastForwardArmedDeadline(
  stub: DurableObjectStub<GameRoom>,
  pastDeadlineAt: number,
): Promise<void> {
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    const roomRow = state.storage.sql
      .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
      .one();
    const gameState = JSON.parse(roomRow.game_state) as { deadlineAt: number | null };
    gameState.deadlineAt = pastDeadlineAt;
    state.storage.sql.exec(
      'UPDATE room_state SET game_state = ? WHERE id = 1',
      JSON.stringify(gameState),
    );
    const effectRow = state.storage.sql
      .exec<{
        payload_json: string;
      }>(`SELECT payload_json FROM effect_outbox WHERE effect_type = 'pictionary.settle.due'`)
      .one();
    const payload = JSON.parse(effectRow.payload_json) as {
      payload: { deadlineAt: number };
    };
    payload.payload.deadlineAt = pastDeadlineAt;
    state.storage.sql.exec(
      'UPDATE effect_outbox SET available_at = ?, payload_json = ? WHERE effect_type = ?',
      pastDeadlineAt,
      JSON.stringify(payload),
      'pictionary.settle.due',
    );
    await state.storage.setAlarm(pastDeadlineAt);
  });
}

async function fireAlarm(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await runInDurableObject(stub, async (instance: GameRoom) => {
    await instance.alarm();
  });
}

describe('Pictionary scheduled settle (Durable Object)', () => {
  it('parks the settle effect at the deadline and settles answering on alarm', async () => {
    const stub = getStub();
    const armed = await armedAnsweringRoom(stub);
    const deadlineAt = armed.deadlineAt;
    if (deadlineAt === null || armed.roundId === null) {
      throw new Error('Expected an armed answering phase');
    }

    const row = await readSettleRow(stub);
    expect(row).not.toBeNull();
    expect(row?.available_at).toBe(deadlineAt);
    expect(row?.status).toBe('pending');
    expect(row?.business_key).toBe(
      `pictionary:settle:${deadlineAt}:${armed.roundId}:${armed.phaseRevision}:${armed.stepIndex}`,
    );
    const payload = JSON.parse(row?.payload_json ?? '{}') as {
      payload: {
        roundId: string;
        phaseRevision: number;
        stepIndex: number;
        deadlineAt: number;
      };
    };
    expect(payload.payload).toEqual({
      roundId: armed.roundId,
      phaseRevision: armed.phaseRevision,
      stepIndex: armed.stepIndex,
      deadlineAt,
    });

    // Flush any immediate effects; afterwards the only pending
    // wake-up is the settle deadline itself.
    await fireAlarm(stub);
    expect(await readAlarm(stub)).toBe(deadlineAt);
    expect((await readState(stub)).phase).toBe('answering');

    const revisionBefore = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    await fastForwardArmedDeadline(stub, Date.now() - 1000);
    await fireAlarm(stub);

    const settled = await readState(stub);
    expect(settled.phase).toBe('settling');
    expect(await readSettleRow(stub)).toBeNull();
    const revisionAfter = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    expect(revisionAfter).toBe((revisionBefore ?? 0) + 1);

    // A repeated alarm never settles twice.
    await fireAlarm(stub);
    expect((await readState(stub)).phase).toBe('settling');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfter);
  });

  it('does not double-settle when a client expire wins the race', async () => {
    const stub = getStub();
    const armed = await armedAnsweringRoom(stub);
    // Move only the phase deadline into the past so the client's
    // public expire is due, and let the client settle first.
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      const roomRow = state.storage.sql
        .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
        .one();
      const gameState = JSON.parse(roomRow.game_state) as { deadlineAt: number | null };
      gameState.deadlineAt = Date.now() - 1000;
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(gameState),
      );
    });
    requireCommitted(
      await dispatch(stub, seatUser(2), {
        type: 'pictionary.phase.expire',
        phaseRevision: armed.phaseRevision,
      }),
    );
    const settled = await readState(stub);
    expect(settled.phase).toBe('settling');
    const revisionAfterClient = (await stub.getSnapshot(roomIdentity(stub)))?.revision;

    // The scheduled delivery now arrives for an arming that is
    // gone: it must consume the effect without settling anything
    // again. The pin no longer matches (revision moved on, deadline
    // is null), so isCurrent no-ops before any dispatch.
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(
        'UPDATE effect_outbox SET available_at = ? WHERE effect_type = ?',
        Date.now() - 1000,
        'pictionary.settle.due',
      );
      await state.storage.setAlarm(Date.now() - 1000);
    });
    await fireAlarm(stub);
    expect((await readState(stub)).phase).toBe('settling');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfterClient);
    expect(await readSettleRow(stub)).toBeNull();
  });

  it('validates the settle effect and internal command strictly at the schema boundary', () => {
    const valid = {
      type: 'pictionary.settle.due',
      payload: { roundId: 'pictionary-round:x', phaseRevision: 1, stepIndex: 0, deadlineAt: 1000 },
    };
    expect(pictionaryEffectSchema.parse(valid)).toEqual(valid);
    expect(
      pictionaryEffectSchema.safeParse({
        ...valid,
        payload: { ...valid.payload, stepIndex: undefined },
      }).success,
    ).toBe(false);
    expect(
      pictionaryEffectSchema.safeParse({
        ...valid,
        payload: { ...valid.payload, extra: 1 },
      }).success,
    ).toBe(false);
    expect(
      pictionaryInternalCommandSchema.parse({ type: 'pictionary.phase.settleExpired' }),
    ).toEqual({ type: 'pictionary.phase.settleExpired' });
  });
});
