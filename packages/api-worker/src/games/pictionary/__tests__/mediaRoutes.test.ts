/** Pictionary media authorization integration through room commands, Durable Objects, and R2. */

import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryTaskForSeat,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_STATE_CODEC,
  type PictionaryDrawingReservation,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { parseRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import { createAnonymousSession } from '../../../../test/uploadTestSupport';

interface RoomIdentity {
  readonly roomCode: string;
  readonly roomId: string;
}

let commandSequence = 0;

async function postJson(path: string, body: unknown, token: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function createPictionaryRoom(token: string): Promise<RoomIdentity> {
  const response = await postJson(
    '/room/create',
    {
      gameType: 'pictionary',
      config: {
        ...DEFAULT_PICTIONARY_CONFIG,
        numberOfPlayers: 4,
        drawingDurationSeconds: null,
        guessDurationSeconds: null,
        transitionDurationSeconds: 0,
        galleryItemDurationSeconds: null,
      },
      creationId: 'pictionary-media-bot-control',
    },
    token,
  );
  expect(response.status).toBe(200);
  const body = await response.json<{ readonly room: RoomIdentity }>();
  return body.room;
}

async function dispatchCommand(
  room: RoomIdentity,
  token: string,
  command: PictionaryPublicCommand,
  controlledSeat: number | null,
): Promise<PictionaryState> {
  commandSequence += 1;
  const response = await postJson(
    '/room/command',
    {
      roomCode: room.roomCode,
      roomId: room.roomId,
      commandId: `pictionary-media-test:${commandSequence}`,
      controlledSeat,
      command,
    },
    token,
  );
  const body: unknown = await response.json();
  if (response.status !== 200) {
    throw new Error(`Room command returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  const result = parseRoomCommandResult(body, PICTIONARY_STATE_CODEC);
  if (result.kind !== 'committed') throw new Error(`Command rejected: ${result.reason}`);
  return result.snapshot.state;
}

function createTestPng(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const dimensions = new DataView(bytes.buffer);
  dimensions.setUint32(16, PICTIONARY_DRAWING_WIDTH);
  dimensions.setUint32(20, PICTIONARY_DRAWING_HEIGHT);
  return bytes;
}

function requireReservation(state: PictionaryState, seat: number): PictionaryDrawingReservation {
  const reservation = state.reservations.find((candidate) => candidate.authorSeat === seat);
  if (reservation === undefined) throw new Error(`Missing drawing reservation for seat ${seat}`);
  return reservation;
}

async function putDrawing(
  room: RoomIdentity,
  token: string,
  reservation: PictionaryDrawingReservation,
  controlledSeat: string | null,
): Promise<Response> {
  const query = controlledSeat === null ? '' : `?controlledSeat=${controlledSeat}`;
  return SELF.fetch(
    `https://test.local/api/games/pictionary/rooms/${room.roomCode}/submissions/${reservation.submissionId}${query}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: createTestPng(),
    },
  );
}

async function commitSeatDrawing(
  room: RoomIdentity,
  token: string,
  seat: number,
  controlledSeat: number | null,
): Promise<PictionaryState> {
  const reserved = await dispatchCommand(
    room,
    token,
    { type: 'pictionary.drawing.reserve' },
    controlledSeat,
  );
  const response = await putDrawing(
    room,
    token,
    requireReservation(reserved, seat),
    controlledSeat === null ? null : String(controlledSeat),
  );
  expect(response.status).toBe(200);
  const result = parseRoomCommandResult(await response.json(), PICTIONARY_STATE_CODEC);
  if (result.kind !== 'committed') throw new Error(`Drawing commit rejected: ${result.reason}`);
  return result.snapshot.state;
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

describe('Pictionary controlled bot media', () => {
  it('authorizes host-controlled bot uploads and active-task reads', async () => {
    const host = await createAnonymousSession();
    const guest = await createAnonymousSession();
    const room = await createPictionaryRoom(host.access_token);
    let state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
      null,
    );
    state = await dispatchCommand(room, host.access_token, { type: 'room.seat.fillBots' }, null);
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.round.start' },
      null,
    );
    for (let seat = 0; seat < 4; seat += 1) {
      state = await dispatchCommand(
        room,
        host.access_token,
        { type: 'pictionary.text.submit', text: `测试题目 ${seat + 1}` },
        seat === 0 ? null : seat,
      );
    }
    expect(state.phase).toBe('transition');
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
      null,
    );
    expect(state).toMatchObject({ phase: 'answering', stepIndex: 1 });

    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.drawing.reserve' },
      1,
    );
    const botReservation = requireReservation(state, 1);

    const forgedUpload = await putDrawing(room, guest.access_token, botReservation, '1');
    expect(forgedUpload.status).toBe(403);
    expect(await forgedUpload.json()).toEqual({ success: false, reason: 'NOT_HOST' });

    const botUpload = await putDrawing(room, host.access_token, botReservation, '1');
    expect(botUpload.status).toBe(200);
    const botUploadResult = parseRoomCommandResult(await botUpload.json(), PICTIONARY_STATE_CODEC);
    if (botUploadResult.kind !== 'committed') {
      throw new Error(`Drawing commit rejected: ${botUploadResult.reason}`);
    }
    state = botUploadResult.snapshot.state;

    state = await commitSeatDrawing(room, host.access_token, 0, null);
    state = await commitSeatDrawing(room, host.access_token, 2, 2);
    state = await commitSeatDrawing(room, host.access_token, 3, 3);
    expect(state.phase).toBe('transition');
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
      null,
    );
    expect(state).toMatchObject({ phase: 'answering', stepIndex: 2 });

    const botTask = getPictionaryTaskForSeat(state, 1);
    const previousEntry = botTask?.previousEntry;
    if (previousEntry === null || previousEntry === undefined || previousEntry.kind !== 'drawing') {
      throw new Error('Controlled bot text task is missing its source drawing');
    }
    const forgedRead = await SELF.fetch(
      `https://test.local/api/games/pictionary/rooms/${room.roomCode}/media/${previousEntry.id}?controlledSeat=1`,
      { headers: { Authorization: `Bearer ${guest.access_token}` } },
    );
    expect(forgedRead.status).toBe(403);
    expect(await forgedRead.json()).toEqual({ success: false, reason: 'NOT_HOST' });

    const botRead = await SELF.fetch(
      `https://test.local/api/games/pictionary/rooms/${room.roomCode}/media/${previousEntry.id}?controlledSeat=1`,
      { headers: { Authorization: `Bearer ${host.access_token}` } },
    );
    expect(botRead.status).toBe(200);
    expect(botRead.headers.get('content-type')).toBe('image/png');
    expect((await botRead.arrayBuffer()).byteLength).toBe(24);
  });
});
