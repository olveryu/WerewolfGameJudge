/**
 * DrawGuess media reads through room commands, the Durable Object and R2:
 * roundEnd serves only the current turn's filed drawing; once the game
 * has ended, every drawing filed in the finished game's turnHistory is
 * readable for the review. A filed drawing whose object is gone (the R2
 * lifecycle) answers 410. Membership checks are unchanged.
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
import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import { createAnonymousSession } from '../../../../test/uploadTestSupport';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult } from '../../../platform/room/types';

const CREATION_ID = 'drawguess-media-history';
const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

type Session = Awaited<ReturnType<typeof createAnonymousSession>>;

interface RoomIdentity {
  readonly roomCode: string;
  readonly roomId: string;
}

interface FiledDrawing {
  readonly turnIndex: number;
  readonly entryId: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

interface FinishedGame {
  readonly host: Session;
  readonly room: RoomIdentity;
  readonly state: DrawGuessState;
  readonly drawings: readonly FiledDrawing[];
}

let commandSequence = 0;

function roomStub(room: RoomIdentity) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromString(room.roomId));
}

async function createDrawGuessRoom(token: string): Promise<RoomIdentity> {
  const response = await SELF.fetch('https://test.local/room/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameType: 'drawguess',
      config: { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
      creationId: CREATION_ID,
    }),
  });
  expect(response.status).toBe(200);
  const body = await response.json<{ readonly room: RoomIdentity }>();
  return body.room;
}

function committedState(result: DispatchRoomResult): DrawGuessState {
  if (result.kind !== 'decided') throw new Error(`Room unavailable: ${result.reason}`);
  if (result.result.kind !== 'committed') {
    throw new Error(`Command rejected: ${result.result.reason}`);
  }
  if (result.result.outcome.kind !== 'success') {
    throw new Error(`Command outcome rejected: ${result.result.outcome.reason}`);
  }
  return DRAWGUESS_STATE_CODEC.parse(result.result.snapshot.state);
}

async function send(
  room: RoomIdentity,
  actorUserId: string,
  command: DrawGuessPublicCommand,
  controlledSeat: number | null = null,
): Promise<DrawGuessState> {
  commandSequence += 1;
  return committedState(
    await roomStub(room).dispatchUserCommand({
      ...room,
      creationId: CREATION_ID,
      commandId: `drawguess-media-test:${commandSequence}`,
      actorUserId,
      controlledSeat,
      command,
    }),
  );
}

async function sendInternal(
  room: RoomIdentity,
  command: DrawGuessInternalCommand,
): Promise<DrawGuessState> {
  commandSequence += 1;
  return committedState(
    await roomStub(room).dispatchInternalCommand({
      ...room,
      creationId: CREATION_ID,
      commandId: `drawguess-media-test:${commandSequence}`,
      systemActorId: 'drawguess-media-test',
      command,
    }),
  );
}

function expirePhase(phase: DrawGuessState['phase'], deadlineAt: number): DrawGuessState['phase'] {
  switch (phase.kind) {
    case 'wordSelect':
    case 'roundEnd':
      return { ...phase, deadlineAt };
    case 'drawing':
      // The codec requires a drawing deadline after its phase start.
      return { ...phase, phaseStartAt: deadlineAt - 90_000, deadlineAt };
    default:
      throw new Error(`DrawGuess ${phase.kind} phase has no deadline`);
  }
}

/** Moves the stored phase deadline into the past, then lets the host re-drive its settle. */
async function settleCurrentPhase(room: RoomIdentity, host: Session): Promise<DrawGuessState> {
  await runInDurableObject(roomStub(room), async (_instance: GameRoomRuntime, durableState) => {
    const sql = durableState.storage.sql;
    const row = sql
      .exec<{ game_state: string }>('SELECT game_state FROM room_state WHERE id = 1')
      .one();
    const stored = DRAWGUESS_STATE_CODEC.parse(JSON.parse(row.game_state));
    const expired: DrawGuessState = {
      ...stored,
      phase: expirePhase(stored.phase, Date.now() - 1_000),
    };
    sql.exec('UPDATE room_state SET game_state = ? WHERE id = 1', canonicalJson(expired));
  });
  return send(room, host.user.id, { type: 'drawguess.phase.retrySettle' });
}

/** A minimal 1024×768 PNG header; the trailing byte keeps each turn's drawing distinct. */
function createTestPng(marker: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(25);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const dimensions = new DataView(bytes.buffer);
  dimensions.setUint32(16, 1024);
  dimensions.setUint32(20, 768);
  bytes[24] = marker;
  return bytes;
}

/** Reserves, uploads and files the current roundEnd drawing for the drawer seat. */
async function fileDrawing(
  room: RoomIdentity,
  host: Session,
  controlledSeat: number | null,
  turnIndex: number,
): Promise<FiledDrawing> {
  const reserved = await send(
    room,
    host.user.id,
    { type: 'drawguess.drawing.reserve' },
    controlledSeat,
  );
  if (reserved.phase.kind !== 'roundEnd' || reserved.phase.reservation === null) {
    throw new Error('Expected a roundEnd drawing reservation');
  }
  const { submissionId, entryId } = reserved.phase.reservation;
  const bytes = createTestPng(turnIndex);
  const query = controlledSeat === null ? '' : `?controlledSeat=${controlledSeat}`;
  const response = await SELF.fetch(
    `https://test.local/api/games/drawguess/rooms/${room.roomCode}/submissions/${submissionId}${query}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${host.access_token}`, 'Content-Type': 'image/png' },
      body: bytes,
    },
  );
  expect(response.status).toBe(200);
  return { turnIndex, entryId, bytes };
}

async function readDrawing(room: RoomIdentity, token: string, entryId: string) {
  return SELF.fetch(
    `https://test.local/api/games/drawguess/rooms/${room.roomCode}/media/${entryId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

interface StartedGame {
  readonly host: Session;
  readonly room: RoomIdentity;
  readonly state: DrawGuessState;
}

/** A four-seat room (host plus three host-controlled bots) whose game has just begun. */
async function startGame(): Promise<StartedGame> {
  const host = await createAnonymousSession();
  const room = await createDrawGuessRoom(host.access_token);
  await send(room, host.user.id, {
    type: 'room.seat.take',
    seat: 0,
    profile: { displayName: '房主' },
  });
  await send(room, host.user.id, { type: 'room.seat.fillBots' });
  const state = await send(room, host.user.id, { type: 'drawguess.game.begin' });
  return { host, room, state };
}

/** Deals and draws the current turn, then settles its drawing phase into roundEnd. */
async function playToRoundEnd(
  game: StartedGame,
  turnIndex: number,
): Promise<{ readonly state: DrawGuessState; readonly controlledSeat: number | null }> {
  const dealt = await sendInternal(game.room, {
    type: 'drawguess.words.dealt',
    turnIndex,
    choices: CHOICES,
  });
  if (dealt.phase.kind !== 'wordSelect') throw new Error('Expected wordSelect');
  const controlledSeat = dealt.phase.drawerSeat === 0 ? null : dealt.phase.drawerSeat;
  await send(
    game.room,
    game.host.user.id,
    {
      type: 'drawguess.word.choose',
      word: CHOICES[turnIndex % CHOICES.length].word,
      phaseRevision: dealt.phaseRevision,
      turnIndex,
    },
    controlledSeat,
  );
  const state = await settleCurrentPhase(game.room, game.host);
  expect(state.phase.kind).toBe('roundEnd');
  return { state, controlledSeat };
}

/**
 * Plays every turn of the game: the first and last drawers file a
 * drawing, the others never upload. The first drawing is checked while
 * its own roundEnd is current and again once that turn has closed but
 * the game is still running.
 */
async function playFinishedGame(): Promise<FinishedGame> {
  const game = await startGame();
  const { host, room } = game;
  const lastTurn = game.state.drawerQueue.length * game.state.config.roundsPerDrawer - 1;
  const drawings: FiledDrawing[] = [];
  let state = game.state;
  for (let turnIndex = 0; turnIndex <= lastTurn; turnIndex += 1) {
    const { controlledSeat } = await playToRoundEnd(game, turnIndex);
    if (turnIndex === 0 || turnIndex === lastTurn) {
      drawings.push(await fileDrawing(room, host, controlledSeat, turnIndex));
    }
    if (turnIndex === 0) {
      expect((await readDrawing(room, host.access_token, drawings[0].entryId)).status).toBe(200);
    }
    state = await settleCurrentPhase(room, host);
    if (turnIndex === 0) {
      expect(state.phase.kind).toBe('wordSelect');
      const closedTurnRead = await readDrawing(room, host.access_token, drawings[0].entryId);
      expect(closedTurnRead.status).toBe(404);
      expect(await closedTurnRead.json()).toEqual({ success: false, reason: '画作不存在' });
    }
  }
  expect(state.phase.kind).toBe('ended');
  return { host, room, state, drawings };
}

beforeEach(async () => {
  commandSequence = 0;
  await env.DB.exec(
    'DELETE FROM room_participants; DELETE FROM room_game_starts; DELETE FROM rooms;',
  );
  const storedMedia = await env.GAME_MEDIA.list();
  await Promise.all(storedMedia.objects.map(({ key }) => env.GAME_MEDIA.delete(key)));
});

afterEach(deleteCurrentRoomAlarms);

describe('DrawGuess ended-phase media reads', () => {
  it('serves every drawing filed in the finished game turn history', async () => {
    const { host, room, state, drawings } = await playFinishedGame();
    expect(state.turnHistory).toHaveLength(8);
    expect(
      state.turnHistory.flatMap((turn) => (turn.entryId === null ? [] : [turn.turnIndex])),
    ).toEqual([0, 7]);
    for (const drawing of drawings) {
      const response = await readDrawing(room, host.access_token, drawing.entryId);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(drawing.bytes);
    }
  });

  it('rejects an entry id outside the turn history', async () => {
    const { host, room } = await playFinishedGame();
    const response = await readDrawing(room, host.access_token, 'drawguess-entry:unknown');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, reason: '画作不存在' });
  });

  it('rejects a reader who holds no seat in the room', async () => {
    const { room, drawings } = await playFinishedGame();
    const guest = await createAnonymousSession();
    const response = await readDrawing(room, guest.access_token, drawings[0].entryId);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, reason: '请先入座' });
  });

  it('answers 410 for a filed history drawing whose object has expired', async () => {
    const { host, room, state, drawings } = await playFinishedGame();
    const [first, last] = state.turnHistory.filter((turn) => turn.pngEntry !== null);
    if (first?.pngEntry == null || last?.entryId == null) {
      throw new Error('Expected two filed drawings in the turn history');
    }
    await env.GAME_MEDIA.delete(first.pngEntry.objectKey);
    const expired = await readDrawing(room, host.access_token, drawings[0].entryId);
    expect(expired.status).toBe(410);
    expect(await expired.json()).toEqual({ success: false, reason: '画作已过期' });
    expect((await readDrawing(room, host.access_token, last.entryId)).status).toBe(200);
  });
});

describe('DrawGuess roundEnd media reads', () => {
  it('answers 410 when the current drawing object has expired', async () => {
    const game = await startGame();
    const { controlledSeat } = await playToRoundEnd(game, 0);
    const drawing = await fileDrawing(game.room, game.host, controlledSeat, 0);
    const filed = await roomStub(game.room).getSnapshot({ ...game.room, creationId: CREATION_ID });
    if (filed === null) throw new Error('Expected the room snapshot');
    const filedState = DRAWGUESS_STATE_CODEC.parse(filed.state);
    if (filedState.phase.kind !== 'roundEnd' || filedState.phase.pngEntry === null) {
      throw new Error('Expected a filed roundEnd drawing');
    }
    await env.GAME_MEDIA.delete(filedState.phase.pngEntry.objectKey);
    const response = await readDrawing(game.room, game.host.access_token, drawing.entryId);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ success: false, reason: '画作已过期' });
  });
});
