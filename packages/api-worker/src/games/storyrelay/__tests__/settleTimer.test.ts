/**
 * Story Relay scheduled settlement, end to end through the real Durable Object:
 * arming a stage deadline parks a `storyrelay.settle.due` row in the effect
 * outbox with `available_at` at the deadline and the room alarm set to it;
 * when the alarm fires, the effect settles the phase through the internal
 * system command — no client needs to submit an expire. Races with the
 * client expire path and repeated alarms settle exactly once.
 */

import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  STORY_RELAY_STATE_CODEC,
  type StoryRelayCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';

const ROOM_CODE = '1234';
const HOST = 'storyrelay-host';
const CONFIG = {
  ...DEFAULT_STORY_RELAY_CONFIG,
  numberOfPlayers: 4,
  writingDurationSeconds: 90,
  transitionDurationSeconds: 3,
  galleryItemDurationSeconds: 10,
} as const;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id = 'storyrelay-host'").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('storyrelay-host')").run();
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
    ) VALUES (?, ?, 'storyrelay', 'storyrelay-host', 'creation-1',
      ?, 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)
    ON CONFLICT DO NOTHING`,
  )
    .bind(stub.id.toString(), ROOM_CODE, canonicalJson(CONFIG))
    .run();
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'storyrelay',
    hostUserId: HOST,
    config: CONFIG,
  });
}

let commandSeq = 0;

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  command: StoryRelayCommand,
  controlledSeat: number | null = null,
): Promise<DispatchRoomResult> {
  commandSeq += 1;
  return stub.dispatchUserCommand({
    ...roomIdentity(stub),
    commandId: `cmd-${commandSeq}`,
    actorUserId: HOST,
    controlledSeat,
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
  command: StoryRelayCommand,
  controlledSeat: number | null = null,
): Promise<StoryRelayState> {
  requireCommitted(await dispatch(stub, command, controlledSeat));
  return readState(stub);
}

async function readState(stub: DurableObjectStub<GameRoom>): Promise<StoryRelayState> {
  const snapshot = await stub.getSnapshot(roomIdentity(stub));
  if (snapshot === null) throw new Error('Expected a room snapshot');
  return STORY_RELAY_STATE_CODEC.parse(snapshot.state);
}

/** Four seated players driven to an armed answering phase. */
async function armedAnsweringRoom(stub: DurableObjectStub<GameRoom>): Promise<StoryRelayState> {
  await initialize(stub);
  await send(stub, { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
  await send(stub, { type: 'room.seat.fillBots' });
  const state = await send(stub, { type: 'storyrelay.game.begin' });
  if (state.phase !== 'answering' || state.deadlineAt === null) {
    throw new Error('Expected an armed answering phase');
  }
  return state;
}

function settleKey(state: StoryRelayState): string {
  return `storyrelay:settle:${state.deadlineAt}:${state.roundId}:${state.phaseRevision}:${state.stepIndex}`;
}

interface SettleRow {
  readonly business_key: string;
  readonly available_at: number;
  readonly status: string;
  readonly payload_json: string;
}

async function readSettleRow(
  stub: DurableObjectStub<GameRoom>,
  businessKey: string,
): Promise<SettleRow | null> {
  let row: SettleRow | null = null;
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    const rows = state.storage.sql
      .exec(
        `SELECT business_key, available_at, status, payload_json FROM effect_outbox
         WHERE effect_type = 'storyrelay.settle.due' AND business_key = ?`,
        businessKey,
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
 * Moves one armed deadline into the past: the persisted phase deadline,
 * the outbox row's delivery time, and the deadline pinned inside the
 * effect payload all shift together, exactly as time passing would leave
 * them — only the wall clock differs.
 */
async function fastForwardArmedDeadline(
  stub: DurableObjectStub<GameRoom>,
  businessKey: string,
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
      .exec<{ payload_json: string }>(
        `SELECT payload_json FROM effect_outbox
         WHERE effect_type = 'storyrelay.settle.due' AND business_key = ?`,
        businessKey,
      )
      .one();
    const payload = JSON.parse(effectRow.payload_json) as {
      payload: { deadlineAt: number };
    };
    payload.payload.deadlineAt = pastDeadlineAt;
    state.storage.sql.exec(
      'UPDATE effect_outbox SET available_at = ?, payload_json = ? WHERE business_key = ?',
      pastDeadlineAt,
      JSON.stringify(payload),
      businessKey,
    );
    await state.storage.setAlarm(pastDeadlineAt);
  });
}

/** Makes one parked settle row due without touching the phase it pinned. */
async function fastForwardRowOnly(
  stub: DurableObjectStub<GameRoom>,
  businessKey: string,
): Promise<void> {
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    state.storage.sql.exec(
      'UPDATE effect_outbox SET available_at = ? WHERE business_key = ?',
      Date.now() - 1000,
      businessKey,
    );
    await state.storage.setAlarm(Date.now() - 1000);
  });
}

async function fireAlarm(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await runInDurableObject(stub, async (instance: GameRoom) => {
    await instance.alarm();
  });
}

async function readyAll(stub: DurableObjectStub<GameRoom>, state: StoryRelayState): Promise<void> {
  for (let seat = 0; seat < 4; seat += 1) {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error('Expected current writing task');
    await send(
      stub,
      {
        type: 'storyrelay.task.ready.set',
        roundId: task.roundId,
        chainId: task.chainId,
        stepIndex: task.stepIndex,
        isReady: true,
      },
      seat === 0 ? null : seat,
    );
  }
}

async function submitAll(
  stub: DurableObjectStub<GameRoom>,
  state: StoryRelayState,
  step: number,
): Promise<void> {
  for (let seat = 0; seat < 4; seat += 1) {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error('Expected current writing task');
    await send(
      stub,
      {
        type: 'storyrelay.text.submit',
        roundId: task.roundId,
        chainId: task.chainId,
        stepIndex: task.stepIndex,
        text: `step-${step}-seat-${seat}`,
      },
      seat === 0 ? null : seat,
    );
  }
}

/** Moves the live phase deadline into the past so a public expire is due. */
async function expirePhase(
  stub: DurableObjectStub<GameRoom>,
  state: StoryRelayState,
): Promise<StoryRelayState> {
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
    await dispatch(stub, {
      type: 'storyrelay.phase.expire',
      phaseRevision: state.phaseRevision,
    }),
  );
  return readState(stub);
}

describe('Story Relay scheduled settle (Durable Object)', () => {
  it('parks the settle effect at the deadline and settles the answering phase on alarm', async () => {
    const stub = getStub();
    const armed = await armedAnsweringRoom(stub);
    const key = settleKey(armed);

    const row = await readSettleRow(stub, key);
    expect(row).not.toBeNull();
    expect(row?.available_at).toBe(armed.deadlineAt);
    expect(row?.status).toBe('pending');
    // Flush any immediate effects left by earlier commands; afterwards
    // the only pending wake-up is the settle deadline itself.
    await fireAlarm(stub);
    expect(await readAlarm(stub)).toBe(armed.deadlineAt);
    expect((await readState(stub)).phase).toBe('answering');

    const revisionBefore = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    await fastForwardArmedDeadline(stub, key, Date.now() - 1000);
    await fireAlarm(stub);

    const settled = await readState(stub);
    expect(settled.phase).toBe('settling');
    expect(settled.deadlineAt).toBeNull();
    expect(await readSettleRow(stub, key)).toBeNull();
    const revisionAfter = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    expect(revisionAfter).toBe((revisionBefore ?? 0) + 1);

    // A repeated alarm never settles twice.
    await fireAlarm(stub);
    expect((await readState(stub)).phase).toBe('settling');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfter);
  });

  it('settles the transition on alarm and re-arms the next answering step', async () => {
    const stub = getStub();
    let state = await armedAnsweringRoom(stub);
    await readyAll(stub, state);
    await submitAll(stub, state, 0);
    state = await readState(stub);
    expect(state.phase).toBe('transition');
    const transitionKey = settleKey(state);
    expect((await readSettleRow(stub, transitionKey))?.available_at).toBe(state.deadlineAt);

    await fastForwardArmedDeadline(stub, transitionKey, Date.now() - 1000);
    await fireAlarm(stub);
    state = await readState(stub);
    expect(state.phase).toBe('answering');
    expect(state.stepIndex).toBe(1);
    expect(await readSettleRow(stub, transitionKey)).toBeNull();
    const answeringKey = settleKey(state);
    expect((await readSettleRow(stub, answeringKey))?.available_at).toBe(state.deadlineAt);
  });

  it('does not double-settle when a client expire wins the race', async () => {
    const stub = getStub();
    const armed = await armedAnsweringRoom(stub);
    const key = settleKey(armed);
    // Move only the phase deadline into the past so the client's public
    // expire is due, and let the client settle first.
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
      await dispatch(stub, {
        type: 'storyrelay.phase.expire',
        phaseRevision: armed.phaseRevision,
      }),
    );
    const settled = await readState(stub);
    expect(settled.phase).toBe('settling');
    const revisionAfterClient = (await stub.getSnapshot(roomIdentity(stub)))?.revision;

    // The scheduled delivery now arrives for an arming that is gone:
    // it must consume the effect without settling anything again.
    await fastForwardRowOnly(stub, key);
    await fireAlarm(stub);
    expect((await readState(stub)).phase).toBe('settling');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfterClient);
    expect(await readSettleRow(stub, key)).toBeNull();
  });

  // A full four-step game drive through the real Durable Object is long;
  // the timeout is a harness budget for the drive, not an assertion.
  it('settles the gallery cell on alarm and advances playback', async () => {
    const stub = getStub();
    let state = await armedAnsweringRoom(stub);
    for (let step = 0; step < 4; step += 1) {
      await readyAll(stub, state);
      await submitAll(stub, state, step);
      state = await readState(stub);
      state = await expirePhase(stub, state);
    }
    expect(state.phase).toBe('gallery');
    expect(state.gallery).toMatchObject({ position: 0, isPlaying: true });
    const galleryKey = settleKey(state);
    expect((await readSettleRow(stub, galleryKey))?.available_at).toBe(state.deadlineAt);

    await fastForwardArmedDeadline(stub, galleryKey, Date.now() - 1000);
    await fireAlarm(stub);
    state = await readState(stub);
    expect(state.gallery).toMatchObject({ position: 1, revealedPosition: 1 });
    expect(await readSettleRow(stub, galleryKey)).toBeNull();
  }, 30_000);
});
