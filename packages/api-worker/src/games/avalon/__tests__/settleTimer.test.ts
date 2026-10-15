/**
 * Avalon scheduled settlement, end to end through the real Durable Object:
 * arming a reveal countdown parks an `avalon.settle.due` row in the effect
 * outbox with `available_at` at the deadline and the room alarm set to it;
 * when the alarm fires, the effect settles the phase through the internal
 * system command — no client needs to submit a timeout. Races with the
 * client timeout path and repeated alarms settle exactly once.
 */

import {
  AVALON_STATE_CODEC,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';

const ROOM_CODE = '1234';
const HOST = 'avalon-host';
const CONFIG = { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 } as const;
const seatUser = (seat: number) => (seat === 0 ? HOST : `u${seat}`);

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare(
    "DELETE FROM users WHERE id IN ('avalon-host', 'u1', 'u2', 'u3', 'u4')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO users (id) VALUES ('avalon-host'), ('u1'), ('u2'), ('u3'), ('u4')",
  ).run();
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
    ) VALUES (?, ?, 'avalon', 'avalon-host', 'creation-1',
      '{"numberOfPlayers":5,"vetoLimit":5,"voteMode":"public"}', 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)
    ON CONFLICT DO NOTHING`,
  )
    .bind(stub.id.toString(), ROOM_CODE)
    .run();
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'avalon',
    hostUserId: HOST,
    config: CONFIG,
  });
}

let commandSeq = 0;

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  actorUserId: string,
  command: AvalonPublicCommand,
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
  command: AvalonPublicCommand,
): Promise<void> {
  requireCommitted(await dispatch(stub, actorUserId, command));
}

async function readState(stub: DurableObjectStub<GameRoom>): Promise<AvalonState> {
  const snapshot = await stub.getSnapshot(roomIdentity(stub));
  if (snapshot === null) throw new Error('Expected a room snapshot');
  return AVALON_STATE_CODEC.parse(snapshot.state);
}

async function ackAudio(stub: DurableObjectStub<GameRoom>): Promise<void> {
  let state = await readState(stub);
  while (state.isAudioPlaying) {
    await send(stub, HOST, { type: 'avalon.audio.ack' });
    state = await readState(stub);
  }
}

/** Five seated humans driven to an armed vote countdown in round 1. */
async function armedVoteRoom(stub: DurableObjectStub<GameRoom>): Promise<AvalonState> {
  await initialize(stub);
  for (let seat = 0; seat < 5; seat += 1) {
    await send(stub, seatUser(seat), {
      type: 'room.seat.take',
      seat,
      profile: { displayName: `P${seat}` },
    });
  }
  await send(stub, HOST, { type: 'avalon.game.start' });
  for (let seat = 0; seat < 5; seat += 1) {
    await send(stub, seatUser(seat), { type: 'avalon.role.viewed' });
  }
  await send(stub, HOST, { type: 'avalon.game.begin' });
  await ackAudio(stub);
  let state = await readState(stub);
  while (state.phase.kind === 'night') {
    for (const seat of getAvalonNightParticipants(state.roles, state.phase.step)) {
      await send(stub, seatUser(seat), { type: 'avalon.night.confirm' });
    }
    await ackAudio(stub);
    state = await readState(stub);
  }
  await send(stub, seatUser(state.leaderSeat), { type: 'avalon.team.updateDraft', seats: [0, 1] });
  await send(stub, seatUser(state.leaderSeat), { type: 'avalon.team.propose' });
  for (let seat = 0; seat < 5; seat += 1) {
    await send(stub, seatUser(seat), { type: 'avalon.team.vote', vote: 'approve' });
  }
  state = await readState(stub);
  if (state.phase.kind !== 'vote' || state.phase.deadlineAt === null) {
    throw new Error('Expected an armed vote countdown');
  }
  return state;
}

interface SettleRow {
  readonly business_key: string;
  readonly available_at: number;
  readonly status: string;
  readonly payload_json: string;
}

async function readSettleRow(
  stub: DurableObjectStub<GameRoom>,
  phase: 'vote' | 'quest',
): Promise<SettleRow | null> {
  let row: SettleRow | null = null;
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    const rows = state.storage.sql
      .exec(
        `SELECT business_key, available_at, status, payload_json FROM effect_outbox
         WHERE effect_type = 'avalon.settle.due' AND business_key LIKE ?`,
        `%:${phase}:%`,
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
 * Moves one armed countdown into the past: the persisted phase deadline,
 * the outbox row's delivery time, and the deadline pinned inside the
 * effect payload all shift together, exactly as time passing would leave
 * them — only the wall clock differs.
 */
async function fastForwardArmedCountdown(
  stub: DurableObjectStub<GameRoom>,
  phase: 'vote' | 'quest',
  pastDeadlineAt: number,
): Promise<void> {
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    const roomRow = state.storage.sql
      .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
      .one();
    const gameState = JSON.parse(roomRow.game_state) as {
      phase: { deadlineAt: number | null };
    };
    gameState.phase.deadlineAt = pastDeadlineAt;
    state.storage.sql.exec(
      'UPDATE room_state SET game_state = ? WHERE id = 1',
      JSON.stringify(gameState),
    );
    const effectRow = state.storage.sql
      .exec<{ payload_json: string }>(
        `SELECT payload_json FROM effect_outbox
         WHERE effect_type = 'avalon.settle.due' AND business_key LIKE ?`,
        `%:${phase}:%`,
      )
      .one();
    const payload = JSON.parse(effectRow.payload_json) as {
      payload: { deadlineAt: number };
    };
    payload.payload.deadlineAt = pastDeadlineAt;
    state.storage.sql.exec(
      `UPDATE effect_outbox SET available_at = ?, payload_json = ?
       WHERE effect_type = 'avalon.settle.due' AND business_key LIKE ?`,
      pastDeadlineAt,
      JSON.stringify(payload),
      `%:${phase}:%`,
    );
    await state.storage.setAlarm(pastDeadlineAt);
  });
}

async function fireAlarm(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await runInDurableObject(stub, async (instance: GameRoom) => {
    await instance.alarm();
  });
}

describe('Avalon scheduled settle (Durable Object)', () => {
  it('parks the settle effect at the deadline and settles the vote on alarm', async () => {
    const stub = getStub();
    const armed = await armedVoteRoom(stub);
    if (armed.phase.kind !== 'vote' || armed.phase.deadlineAt === null) {
      throw new Error('Expected an armed vote countdown');
    }
    const deadlineAt = armed.phase.deadlineAt;

    const row = await readSettleRow(stub, 'vote');
    expect(row).not.toBeNull();
    expect(row?.available_at).toBe(deadlineAt);
    expect(row?.status).toBe('pending');
    expect(row?.business_key).toBe(
      `avalon:settle:${armed.gameSequence}:vote:${armed.phase.round}:${deadlineAt}`,
    );
    // Flush any immediate effects left by earlier commands; afterwards
    // the only pending wake-up is the settle deadline itself.
    await fireAlarm(stub);
    expect(await readAlarm(stub)).toBe(deadlineAt);
    expect((await readState(stub)).phase.kind).toBe('vote');

    const revisionBefore = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    await fastForwardArmedCountdown(stub, 'vote', Date.now() - 1000);
    await fireAlarm(stub);

    const settled = await readState(stub);
    expect(settled.phase.kind).toBe('quest');
    expect(settled.lastVoteResult?.approveCount).toBe(5);
    expect(await readSettleRow(stub, 'vote')).toBeNull();
    const revisionAfter = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    expect(revisionAfter).toBe((revisionBefore ?? 0) + 1);

    // A repeated alarm never settles twice.
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('quest');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfter);
  });

  it('settles the quest on alarm at the quest arming point', async () => {
    const stub = getStub();
    await armedVoteRoom(stub);
    await send(stub, HOST, { type: 'avalon.vote.finish' });
    await send(stub, seatUser(0), { type: 'avalon.quest.play', play: 'success' });
    await send(stub, seatUser(1), { type: 'avalon.quest.play', play: 'success' });
    const armed = await readState(stub);
    if (armed.phase.kind !== 'quest' || armed.phase.deadlineAt === null) {
      throw new Error('Expected an armed quest countdown');
    }
    const row = await readSettleRow(stub, 'quest');
    expect(row?.available_at).toBe(armed.phase.deadlineAt);
    expect(row?.business_key).toBe(
      `avalon:settle:${armed.gameSequence}:quest:${armed.phase.round}:${armed.phase.deadlineAt}`,
    );

    await fastForwardArmedCountdown(stub, 'quest', Date.now() - 1000);
    await fireAlarm(stub);
    const settled = await readState(stub);
    expect(settled.phase.kind).toBe('nominate');
    expect(settled.questResults[0]).toBe('success');
    expect(await readSettleRow(stub, 'quest')).toBeNull();
  });

  it('does not double-settle when a client timeout wins the race', async () => {
    const stub = getStub();
    await armedVoteRoom(stub);
    // Move only the phase deadline into the past so the client's public
    // timeout is due, and let the client settle first.
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      const roomRow = state.storage.sql
        .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
        .one();
      const gameState = JSON.parse(roomRow.game_state) as {
        phase: { deadlineAt: number | null };
      };
      gameState.phase.deadlineAt = Date.now() - 1000;
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(gameState),
      );
    });
    requireCommitted(await dispatch(stub, seatUser(2), { type: 'avalon.phase.expire' }));
    const settled = await readState(stub);
    expect(settled.phase.kind).toBe('quest');
    const revisionAfterClient = (await stub.getSnapshot(roomIdentity(stub)))?.revision;

    // The scheduled delivery now arrives for an arming that is gone:
    // it must consume the effect without settling anything again.
    await fastForwardQuestPhaseDeadlineFree(stub);
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('quest');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfterClient);
    expect(await readSettleRow(stub, 'vote')).toBeNull();
  });
});

/** Makes the parked settle row due; the phase it pinned no longer exists. */
async function fastForwardQuestPhaseDeadlineFree(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    state.storage.sql.exec(
      `UPDATE effect_outbox SET available_at = ? WHERE effect_type = 'avalon.settle.due'`,
      Date.now() - 1000,
    );
    await state.storage.setAlarm(Date.now() - 1000);
  });
}
