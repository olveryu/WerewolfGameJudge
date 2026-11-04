/**
 * DrawGuess scheduled settlement, end to end through the real Durable
 * Object: arming a phase deadline parks a `drawguess.settle.due` row
 * in the effect outbox with `available_at` at the deadline and the
 * room alarm set to it; when the alarm fires, the effect settles the
 * phase through the internal system command — no client needs to
 * submit phase.expire. A compressed deadline re-arms with a fresh
 * row, and the parked old row no-ops when it later comes due.
 */

import {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_STATE_CODEC,
  type DrawGuessInternalCommand,
  type DrawGuessPublicCommand,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';

const ROOM_CODE = '1234';
const HOST = 'drawguess-host';
const CONFIG = { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 };
const seatUser = (seat: number) => (seat === 0 ? HOST : `u${seat}`);

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN ('drawguess-host', 'u1', 'u2', 'u3')").run();
  await env.DB.prepare(
    "INSERT INTO users (id) VALUES ('drawguess-host'), ('u1'), ('u2'), ('u3')",
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
    ) VALUES (?, ?, 'drawguess', 'drawguess-host', 'creation-1',
      ?, 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)
    ON CONFLICT DO NOTHING`,
  )
    .bind(stub.id.toString(), ROOM_CODE, canonicalJson(CONFIG))
    .run();
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'drawguess',
    hostUserId: HOST,
    config: CONFIG,
  });
}

let commandSeq = 0;

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  actorUserId: string,
  command: DrawGuessPublicCommand,
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

async function dispatchInternal(
  stub: DurableObjectStub<GameRoom>,
  command: DrawGuessInternalCommand,
): Promise<DispatchRoomResult> {
  commandSeq += 1;
  return stub.dispatchInternalCommand({
    ...roomIdentity(stub),
    commandId: `cmd-${commandSeq}`,
    systemActorId: 'drawguess-test-effect',
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
  command: DrawGuessPublicCommand,
): Promise<void> {
  requireCommitted(await dispatch(stub, actorUserId, command));
}

async function sendInternal(
  stub: DurableObjectStub<GameRoom>,
  command: DrawGuessInternalCommand,
): Promise<void> {
  requireCommitted(await dispatchInternal(stub, command));
}

async function readState(stub: DurableObjectStub<GameRoom>): Promise<DrawGuessState> {
  const snapshot = await stub.getSnapshot(roomIdentity(stub));
  if (snapshot === null) throw new Error('Expected a room snapshot');
  return DRAWGUESS_STATE_CODEC.parse(snapshot.state);
}

/** Four seated humans driven to an armed wordSelect phase in turn 0. */
async function armedWordSelectRoom(stub: DurableObjectStub<GameRoom>): Promise<DrawGuessState> {
  await initialize(stub);
  for (let seat = 0; seat < 4; seat += 1) {
    await send(stub, seatUser(seat), {
      type: 'room.seat.take',
      seat,
      profile: { displayName: `P${seat}` },
    });
  }
  await send(stub, HOST, { type: 'drawguess.game.begin' });
  await sendInternal(stub, { type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES });
  const state = await readState(stub);
  if (state.phase.kind !== 'wordSelect' || state.phase.deadlineAt === null) {
    throw new Error('Expected an armed wordSelect deadline');
  }
  return state;
}

interface SettleRow {
  readonly business_key: string;
  readonly available_at: number;
  readonly status: string;
  readonly payload_json: string;
  readonly attempt_count?: number;
  readonly last_error?: string | null;
}

async function readSettleRows(stub: DurableObjectStub<GameRoom>): Promise<SettleRow[]> {
  let rows: SettleRow[] = [];
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    rows = state.storage.sql
      .exec(
        `SELECT business_key, available_at, status, payload_json, attempt_count, last_error
         FROM effect_outbox
         WHERE effect_type = 'drawguess.settle.due' ORDER BY available_at`,
      )
      .toArray() as unknown as SettleRow[];
  });
  return rows;
}

async function fireAlarm(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await runInDurableObject(stub, async (instance: GameRoom) => {
    await instance.alarm();
  });
}

/** Moves the persisted phase deadline into the past, leaving parked effect rows alone. */
async function movePhaseDeadlineToPast(
  stub: DurableObjectStub<GameRoom>,
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
  });
}

/**
 * Makes one parked settle row due. When `shiftPayload` is set, the
 * deadline pinned inside the effect payload and the persisted phase
 * deadline shift together, exactly as time passing would leave them.
 * Otherwise only the delivery time moves: the pinned arming no longer
 * matches the room, so delivery must no-op.
 */
async function makeRowDue(
  stub: DurableObjectStub<GameRoom>,
  businessKey: string,
  pastDeadlineAt: number,
  shiftPayload: boolean,
): Promise<void> {
  await runInDurableObject(stub, async (_instance: GameRoom, state) => {
    if (shiftPayload) {
      const roomRow = state.storage.sql
        .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
        .one();
      const gameState = JSON.parse(roomRow.game_state) as {
        phase: { deadlineAt: number | null; phaseStartAt?: number };
      };
      // The drawing codec requires deadlineAt > phaseStartAt, so
      // never move a deadline to or before the phase start: floor at
      // one millisecond after the start, still in the past by the
      // time the alarm fires.
      const flooredPast = Math.max(pastDeadlineAt, (gameState.phase.phaseStartAt ?? 0) + 1);
      gameState.phase.deadlineAt = flooredPast;
      state.storage.sql.exec(
        'UPDATE room_state SET game_state = ? WHERE id = 1',
        JSON.stringify(gameState),
      );
      const effectRow = state.storage.sql
        .exec<{
          payload_json: string;
        }>('SELECT payload_json FROM effect_outbox WHERE business_key = ?', businessKey)
        .one();
      const payload = JSON.parse(effectRow.payload_json) as {
        payload: { deadlineAt: number };
      };
      payload.payload.deadlineAt = flooredPast;
      state.storage.sql.exec(
        'UPDATE effect_outbox SET available_at = ?, payload_json = ? WHERE business_key = ?',
        flooredPast,
        JSON.stringify(payload),
        businessKey,
      );
    } else {
      state.storage.sql.exec(
        'UPDATE effect_outbox SET available_at = ? WHERE business_key = ?',
        pastDeadlineAt,
        businessKey,
      );
    }
    await state.storage.setAlarm(pastDeadlineAt);
  });
}

describe('DrawGuess scheduled settle (Durable Object)', () => {
  it('parks the settle effect at the deadline and settles wordSelect on alarm', async () => {
    const stub = getStub();
    const armed = await armedWordSelectRoom(stub);
    if (armed.phase.kind !== 'wordSelect' || armed.phase.deadlineAt === null) {
      throw new Error('Expected an armed wordSelect deadline');
    }
    const deadlineAt = armed.phase.deadlineAt;

    const rows = await readSettleRows(stub);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.available_at).toBe(deadlineAt);
    expect(rows[0]?.status).toBe('pending');
    expect(rows[0]?.business_key).toBe(
      `drawguess:settle:${armed.gameSequence}:${deadlineAt}:${armed.phaseRevision}:${armed.turnIndex}`,
    );
    // Flush any immediate effects left by earlier commands; the
    // settle row must stay parked and the phase must not move. (The
    // stored alarm value itself is not asserted: #scheduleAlarm
    // never moves an alarm later, and invoking alarm() directly
    // bypasses the runtime clearing a fired alarm, so a stale
    // earlier alarm time can linger in this harness.)
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('wordSelect');
    expect(await readSettleRows(stub)).toHaveLength(1);

    const revisionBefore = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    await makeRowDue(stub, rows[0].business_key, Date.now() - 1000, true);
    await fireAlarm(stub);

    const settled = await readState(stub);
    expect(settled.phase.kind).toBe('drawing');
    // Settling wordSelect arms drawing through beginDrawing, so
    // exactly one settle row remains: the new drawing arming.
    const rearmed = await readSettleRows(stub);
    expect(rearmed).toHaveLength(1);
    if (settled.phase.kind !== 'drawing' || settled.phase.deadlineAt === null) {
      throw new Error('Expected a drawing deadline');
    }
    expect(rearmed[0]?.business_key).toBe(
      `drawguess:settle:${settled.gameSequence}:${settled.phase.deadlineAt}:${settled.phaseRevision}:${settled.turnIndex}`,
    );
    expect(rearmed[0]?.available_at).toBe(settled.phase.deadlineAt);
    const revisionAfter = (await stub.getSnapshot(roomIdentity(stub)))?.revision;
    expect(revisionAfter).toBe((revisionBefore ?? 0) + 1);

    // A repeated alarm never settles twice.
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('drawing');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfter);
    expect(await readSettleRows(stub)).toHaveLength(1);
  });

  it('re-arms on guess compression and no-ops the parked old row', async () => {
    const stub = getStub();
    const armed = await armedWordSelectRoom(stub);
    await send(stub, HOST, {
      type: 'drawguess.word.choose',
      word: CHOICES[0].word,
      phaseRevision: armed.phaseRevision,
      turnIndex: armed.turnIndex,
    });
    const drawing = await readState(stub);
    if (drawing.phase.kind !== 'drawing' || drawing.phase.deadlineAt === null) {
      throw new Error('Expected a drawing deadline');
    }
    const drawingDeadline = drawing.phase.deadlineAt;

    // A correct first guess compresses the deadline to 30s out.
    await send(stub, seatUser(1), {
      type: 'drawguess.guess.submit',
      text: CHOICES[0].word,
      phaseRevision: drawing.phaseRevision,
      turnIndex: drawing.turnIndex,
    });
    const compressed = await readState(stub);
    if (compressed.phase.kind !== 'drawing' || compressed.phase.deadlineAt === null) {
      throw new Error('Expected a compressed drawing deadline');
    }
    expect(compressed.phase.deadlineAt).toBeLessThan(drawingDeadline);

    // Three rows are parked: the wordSelect arming (still parked
    // from the deal), the drawing arming, and the new compressed
    // arming. Identify the compressed and old drawing rows by
    // business key, never by position.
    const rows = await readSettleRows(stub);
    expect(rows).toHaveLength(3);
    const compressedKey = `drawguess:settle:${compressed.gameSequence}:${compressed.phase.deadlineAt}:${compressed.phaseRevision}:${compressed.turnIndex}`;
    const drawingKey = `drawguess:settle:${drawing.gameSequence}:${drawingDeadline}:${drawing.phaseRevision}:${drawing.turnIndex}`;
    const compressedRow = rows.find((row) => row.business_key === compressedKey);
    const oldRow = rows.find((row) => row.business_key === drawingKey);
    if (compressedRow === undefined || oldRow === undefined) {
      throw new Error(`Expected compressed and drawing rows, got ${JSON.stringify(rows)}`);
    }
    expect(compressedRow.available_at).toBe(compressed.phase.deadlineAt);
    expect(oldRow.available_at).toBe(drawingDeadline);

    await makeRowDue(stub, compressedRow.business_key, Date.now() - 1000, true);
    await fireAlarm(stub);
    const ended = await readState(stub);
    expect(ended.phase.kind).toBe('roundEnd');
    // Settling drawing arms roundEnd through endRound, so three
    // rows remain: the stale wordSelect row, the stale old drawing
    // row, and the new roundEnd arming.
    const afterSettle = await readSettleRows(stub);
    expect(afterSettle).toHaveLength(3);
    expect(afterSettle.map((row) => row.business_key)).toContain(oldRow.business_key);
    const revisionAfterSettle = (await stub.getSnapshot(roomIdentity(stub)))?.revision;

    // The old row comes due for an arming that is gone: it must
    // consume without settling anything again, leaving the wordSelect
    // row and the roundEnd arming parked.
    await makeRowDue(stub, oldRow.business_key, Date.now() - 1000, false);
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('roundEnd');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfterSettle);
    const remaining = await readSettleRows(stub);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((row) => row.business_key)).not.toContain(oldRow.business_key);
  });

  it('does not double-settle when a client expire wins the race', async () => {
    const stub = getStub();
    const armed = await armedWordSelectRoom(stub);
    const rows = await readSettleRows(stub);
    expect(rows).toHaveLength(1);
    // Move only the phase deadline into the past so the client's
    // public expire is due, and let the client settle first.
    await movePhaseDeadlineToPast(stub, Date.now() - 1000);
    requireCommitted(
      await dispatch(stub, HOST, {
        type: 'drawguess.phase.expire',
        phaseRevision: armed.phaseRevision,
        turnIndex: armed.turnIndex,
      }),
    );
    expect((await readState(stub)).phase.kind).toBe('drawing');
    const revisionAfterClient = (await stub.getSnapshot(roomIdentity(stub)))?.revision;

    // The scheduled delivery now arrives for an arming that is gone:
    // it must consume the effect without settling anything again,
    // leaving only the drawing arming parked.
    await makeRowDue(stub, rows[0].business_key, Date.now() - 1000, false);
    await fireAlarm(stub);
    expect((await readState(stub)).phase.kind).toBe('drawing');
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(revisionAfterClient);
    const remaining = await readSettleRows(stub);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.business_key).not.toBe(rows[0].business_key);
  });
});
