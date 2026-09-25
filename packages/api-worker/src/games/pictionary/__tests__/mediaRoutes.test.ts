/** Pictionary media authorization integration through room commands, Durable Objects, and R2. */

import {
  createPictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryTaskForSeat,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_STATE_CODEC,
  type PictionaryCommandInput,
  type PictionaryDrawingReservation,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { parseRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import { createAnonymousSession } from '../../../../test/uploadTestSupport';
import type { GameRoomRuntime } from '../../../platform/room/GameRoomRuntime';
import { RoomRepository } from '../../../platform/room/roomRepository';
import { getWorkerGameModule } from '../../catalog';

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
  command: PictionaryCommandInput,
  controlledSeat: number | null,
): Promise<PictionaryState> {
  commandSequence += 1;
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromString(room.roomId));
  const snapshot = await stub.getSnapshot({ ...room, creationId: 'pictionary-media-bot-control' });
  if (snapshot === null) throw new Error('Pictionary test room is missing');
  const state = PICTIONARY_STATE_CODEC.parse(snapshot.state);
  const response = await postJson(
    '/room/command',
    {
      roomCode: room.roomCode,
      roomId: room.roomId,
      commandId: `pictionary-media-test:${commandSequence}`,
      controlledSeat,
      command: createPictionaryCommand(state, command, controlledSeat ?? 0),
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
  bytes = createTestPng(),
): Promise<Response> {
  const query = controlledSeat === null ? '' : `?controlledSeat=${controlledSeat}`;
  return SELF.fetch(
    `https://test.local/api/games/pictionary/rooms/${room.roomCode}/submissions/${reservation.submissionId}${query}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: bytes,
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

async function markEverySeatReady(
  room: RoomIdentity,
  token: string,
  state: PictionaryState,
): Promise<PictionaryState> {
  let nextState = state;
  for (let seat = 0; seat < nextState.config.numberOfPlayers; seat += 1) {
    nextState = await dispatchCommand(
      room,
      token,
      { type: 'pictionary.task.ready.set', isReady: true },
      seat === 0 ? null : seat,
    );
  }
  expect(nextState.phase).toBe('settling');
  return nextState;
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

describe('Pictionary current persisted relay state', () => {
  it('preserves pending uploads, room metadata and exact replayable receipts', async () => {
    const host = await createAnonymousSession();
    const room = await createPictionaryRoom(host.access_token);
    await dispatchCommand(
      room,
      host.access_token,
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
      null,
    );
    await dispatchCommand(room, host.access_token, { type: 'room.seat.fillBots' }, null);
    let state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.round.start' },
      null,
    );
    state = await markEverySeatReady(room, host.access_token, state);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      state = await dispatchCommand(
        room,
        host.access_token,
        {
          type: 'pictionary.text.submit',
          text: `prompt-${seat}`,
        },
        seat === 0 ? null : seat,
      );
    }
    state = await dispatchCommand(
      room,
      host.access_token,
      {
        type: 'pictionary.phase.expire',
        phaseRevision: state.phaseRevision,
      },
      null,
    );
    state = await markEverySeatReady(room, host.access_token, state);
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.drawing.reserve' },
      null,
    );
    const reservation = requireReservation(state, 0);
    const commandId = `pictionary-media-test:${commandSequence}`;
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromString(room.roomId));
    await runInDurableObject(stub, async (instance: GameRoomRuntime, durableState) => {
      const sql = durableState.storage.sql;
      const before = sql.exec('SELECT * FROM room_state').one();
      const receipts = sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray();
      const outbox = sql.exec('SELECT * FROM effect_outbox ORDER BY id').toArray();
      const identity = { ...room, creationId: 'pictionary-media-bot-control' };
      const snapshot = await instance.getSnapshot(identity);
      expect(snapshot?.state).toEqual(state);
      expect(sql.exec('SELECT * FROM room_state').one()).toEqual(before);
      expect(sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray()).toEqual(
        receipts,
      );
      expect(sql.exec('SELECT * FROM effect_outbox ORDER BY id').toArray()).toEqual(outbox);
      const replay = await instance.dispatchUserCommand({
        ...identity,
        commandId,
        actorUserId: state.hostUserId,
        controlledSeat: null,
        command: createPictionaryCommand(state, { type: 'pictionary.drawing.reserve' }, 0),
      });
      expect(replay).toMatchObject({
        kind: 'decided',
        isReplay: true,
        result: { kind: 'committed', snapshot },
      });
      expect(await instance.getSnapshot(identity)).toEqual(snapshot);
    });
    const uploaded = await putDrawing(room, host.access_token, reservation, null);
    expect(uploaded.status).toBe(200);
    const result = parseRoomCommandResult(await uploaded.json(), PICTIONARY_STATE_CODEC);
    if (result.kind !== 'committed') throw new Error(result.reason);
    expect(result.snapshot.state.chains.flatMap((chain) => chain.entries)).toContainEqual(
      expect.objectContaining({ kind: 'drawing', authorSeat: 0, id: reservation.entryId }),
    );
  });

  it('rejects unsupported persisted versions without rewriting room data', async () => {
    const host = await createAnonymousSession();
    const room = await createPictionaryRoom(host.access_token);
    await dispatchCommand(room, host.access_token, { type: 'room.seat.fillBots' }, null);
    await dispatchCommand(room, host.access_token, { type: 'pictionary.round.start' }, null);
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromString(room.roomId));
    await runInDurableObject(stub, async (_instance: GameRoomRuntime, durableState) => {
      const sql = durableState.storage.sql;
      sql.exec(`UPDATE room_state SET state_version = 7,
        game_state = json_set(game_state, '$.stateVersion', 7)`);
      const before = sql.exec('SELECT * FROM room_state').one();
      const receipts = sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray();
      const repository = new RoomRepository(durableState.storage, getWorkerGameModule);
      expect(() => repository.readRoom()).toThrow('state version');
      expect(sql.exec('SELECT * FROM room_state').one()).toEqual(before);
      expect(sql.exec('SELECT * FROM command_receipts ORDER BY command_id').toArray()).toEqual(
        receipts,
      );
    });
  });
});

describe('Pictionary spectator media', () => {
  it('invalidates aborted uploads while preserving accepted artwork', async () => {
    const host = await createAnonymousSession();
    const viewer = await createAnonymousSession();
    const room = await createPictionaryRoom(host.access_token);
    await dispatchCommand(
      room,
      host.access_token,
      { type: 'room.seat.take', seat: 0, profile: { displayName: '原始作者' } },
      null,
    );
    await dispatchCommand(room, host.access_token, { type: 'room.seat.fillBots' }, null);
    await dispatchCommand(room, host.access_token, { type: 'pictionary.round.start' }, null);
    await dispatchCommand(room, host.access_token, { type: 'pictionary.phase.finish' }, null);
    const oldProtocol = await postJson(
      '/room/command',
      {
        ...room,
        commandId: 'unscoped',
        controlledSeat: null,
        command: { type: 'pictionary.text.submit', text: 'old' },
      },
      host.access_token,
    );
    expect(oldProtocol.status).toBe(400);
    for (const seat of [1, 2, 3])
      await dispatchCommand(
        room,
        host.access_token,
        { type: 'pictionary.task.empty.submit' },
        seat,
      );
    let state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.text.submit', text: '题目' },
      null,
    );
    expect(
      state.chains.flatMap((chain) => chain.entries).filter((entry) => entry.kind === 'missed'),
    ).toHaveLength(3);
    await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
      null,
    );
    await dispatchCommand(room, host.access_token, { type: 'pictionary.phase.finish' }, null);
    state = await commitSeatDrawing(room, host.access_token, 0, null);
    const accepted = state.chains
      .flatMap((chain) => chain.entries)
      .find((entry) => entry.kind === 'drawing');
    if (accepted === undefined) throw new Error('Accepted drawing is missing');
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.drawing.reserve' },
      2,
    );
    const aborted = requireReservation(state, 2);
    state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.round.abort' },
      null,
    );
    expect(state.phase).toBe('aborted');
    expect(state.reservations).toHaveLength(0);
    expect((await putDrawing(room, host.access_token, aborted, '2')).status).toBe(409);
    const image = await SELF.fetch(
      `https://test.local/api/games/pictionary/rooms/${room.roomCode}/media/${accepted.id}`,
      { headers: { Authorization: `Bearer ${viewer.access_token}` } },
    );
    expect(image.status).toBe(200);
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(createTestPng());
  });

  it('allows unseated viewers to read drawings only after the round reaches gallery', async () => {
    const host = await createAnonymousSession();
    const guest = await createAnonymousSession();
    const room = await createPictionaryRoom(host.access_token);
    await dispatchCommand(
      room,
      host.access_token,
      { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
      null,
    );
    await dispatchCommand(room, host.access_token, { type: 'room.seat.fillBots' }, null);
    let state = await dispatchCommand(
      room,
      host.access_token,
      { type: 'pictionary.round.start' },
      null,
    );
    for (let step = 0; step < 2; step += 1) {
      state = await markEverySeatReady(room, host.access_token, state);
      for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
        state =
          step === 0
            ? await dispatchCommand(
                room,
                host.access_token,
                { type: 'pictionary.text.submit', text: `测试题目 ${seat + 1}` },
                seat === 0 ? null : seat,
              )
            : await commitSeatDrawing(room, host.access_token, seat, seat === 0 ? null : seat);
      }
      state = await dispatchCommand(
        room,
        host.access_token,
        { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
        null,
      );
    }
    expect(state).toMatchObject({ phase: 'answering', stepIndex: 2 });
    const entry = state.chains
      .flatMap((chain) => chain.entries)
      .find((entry) => entry.kind === 'drawing');
    if (entry === undefined) throw new Error('Round is missing its test drawing');
    const mediaUrl = `https://test.local/api/games/pictionary/rooms/${room.roomCode}/media/${entry.id}`;
    const activeRead = await SELF.fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${guest.access_token}` },
    });
    expect(activeRead.status).toBe(403);
    expect(await activeRead.json()).toEqual({
      success: false,
      reason: 'PICTIONARY_MEDIA_FORBIDDEN',
    });

    for (let step = 2; step < state.config.numberOfPlayers; step += 1) {
      state = await markEverySeatReady(room, host.access_token, state);
      for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
        state = await dispatchCommand(
          room,
          host.access_token,
          { type: 'pictionary.task.empty.submit' },
          seat === 0 ? null : seat,
        );
      }
      state = await dispatchCommand(
        room,
        host.access_token,
        { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
        null,
      );
    }
    expect(state.phase).toBe('gallery');
    const galleryRead = await SELF.fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${guest.access_token}` },
    });
    expect(galleryRead.status).toBe(200);
    expect(galleryRead.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await galleryRead.arrayBuffer())).toEqual(createTestPng());
    const unauthenticatedRead = await SELF.fetch(mediaUrl);
    expect(unauthenticatedRead.status).toBe(401);

    while (state.phase === 'gallery') {
      state = await dispatchCommand(
        room,
        host.access_token,
        { type: 'pictionary.gallery.advance' },
        null,
      );
    }
    expect(state.phase).toBe('ended');
    const endedRead = await SELF.fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${guest.access_token}` },
    });
    expect(endedRead.status).toBe(200);
    expect(new Uint8Array(await endedRead.arrayBuffer())).toEqual(createTestPng());
  });
});

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
    state = await markEverySeatReady(room, host.access_token, state);
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
    state = await markEverySeatReady(room, host.access_token, state);

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

    const replay = await putDrawing(room, host.access_token, botReservation, '1');
    expect(replay.status).toBe(200);
    expect(parseRoomCommandResult(await replay.json(), PICTIONARY_STATE_CODEC)).toEqual(
      botUploadResult,
    );
    const changedPng = createTestPng();
    changedPng[8] = 1;
    const conflict = await putDrawing(room, host.access_token, botReservation, '1', changedPng);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ success: false, reason: 'PICTIONARY_UPLOAD_CONFLICT' });
    const unauthorizedReplay = await putDrawing(room, guest.access_token, botReservation, '1');
    expect(unauthorizedReplay.status).toBe(403);

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

    const lateReplay = await putDrawing(room, host.access_token, botReservation, '1');
    expect(lateReplay.status).toBe(200);
    const lateResult = parseRoomCommandResult(await lateReplay.json(), PICTIONARY_STATE_CODEC);
    expect(lateResult).toEqual(botUploadResult);

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
