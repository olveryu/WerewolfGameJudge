/**
 * Authenticated Pictionary drawing upload and retrieval routes.
 *
 * @throws 400 for malformed PNG data, 401 for missing authentication, 403 for
 * disallowed media access, 404 for missing rooms/media, 409 for stale reservations, and
 * 413 for oversized uploads.
 */

import {
  getPictionaryTaskForSeat,
  getPictionaryUserSeat,
  isBotSeat,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_STATE_CODEC,
  type PictionaryDrawingEntry,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { requireAuth } from '../../features/auth/tokenAuth';
import { callDurableObject } from '../../platform/http/callDurableObject';
import {
  buildDrawingGetResponse,
  DRAWING_PNG_CONTENT_TYPE,
  type DrawingUploadOptions,
  failMediaRequest,
  putImmutableDrawing,
  readDrawingUpload,
} from '../../platform/room/mediaDrawing';
import { createMediaRoomAccess } from '../../platform/room/mediaRoomAccess';
import type { ActiveRoomDirectoryEntry } from '../../platform/room/roomDirectory';

const PICTIONARY_DRAWING_UPLOAD_OPTIONS: DrawingUploadOptions = {
  width: PICTIONARY_DRAWING_WIDTH,
  height: PICTIONARY_DRAWING_HEIGHT,
  maxBytes: PICTIONARY_DRAWING_MAX_BYTES,
  reasons: {
    invalidContentLength: 'INVALID_CONTENT_LENGTH',
    drawingTooLarge: 'DRAWING_TOO_LARGE',
    bodyRequired: 'DRAWING_BODY_REQUIRED',
    invalidBody: 'INVALID_DRAWING_BODY',
    lengthMismatch: 'INVALID_CONTENT_LENGTH',
    invalidPng: 'INVALID_PNG',
    invalidDimensions: 'INVALID_DRAWING_DIMENSIONS',
    contentTypeInvalid: 'DRAWING_CONTENT_TYPE_INVALID',
  },
};

const mediaRoomAccess = createMediaRoomAccess({
  codec: PICTIONARY_STATE_CODEC,
  getUserSeat: getPictionaryUserSeat,
  isBotSeat: (state, seat) => isBotSeat(state.roster, seat),
  reasons: {
    roomNotFound: 'ROOM_NOT_FOUND',
    roomGameTypeMismatch: 'ROOM_GAME_TYPE_MISMATCH',
    roomStateNotFound: 'ROOM_STATE_NOT_FOUND',
    controlledSeatInvalid: 'CONTROLLED_SEAT_INVALID',
    notHost: 'NOT_HOST',
    controlledSeatNotBot: 'CONTROLLED_SEAT_NOT_BOT',
  },
});

function buildObjectKey(
  room: ActiveRoomDirectoryEntry,
  state: PictionaryState,
  submissionId: string,
): string {
  if (state.roundId === null) return failMediaRequest(409, 'PICTIONARY_ROUND_NOT_ACTIVE');
  return `pictionary/${room.creationId}/${state.roundId}/${submissionId}.png`;
}

function findDrawingEntry(state: PictionaryState, entryId: string): PictionaryDrawingEntry | null {
  for (const chain of state.chains) {
    const entry = chain.entries.find((candidate) => candidate.id === entryId);
    if (entry?.kind === 'drawing') return entry;
  }
  return null;
}

// Exported for unit testing the authorization matrix; production behavior unchanged.
export function canReadDrawing(
  state: PictionaryState,
  seat: number | null,
  entryId: string,
): boolean {
  if (state.phase === 'gallery' || state.phase === 'ended' || state.phase === 'aborted') {
    return true;
  }
  if (seat === null) return false;
  if (state.phase !== 'answering' && state.phase !== 'settling') return false;
  return getPictionaryTaskForSeat(state, seat)?.previousEntry?.id === entryId;
}

export const pictionaryMediaRoutes = new Hono<AppEnv>();

pictionaryMediaRoutes.put('/:roomCode/submissions/:submissionId', requireAuth, async (c) => {
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  const seat = mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return failMediaRequest(403, 'NOT_SEATED');
  const submissionId = c.req.param('submissionId');
  const objectKey = buildObjectKey(roomContext.room, roomContext.state, submissionId);
  const reservation = roomContext.state.reservations.find(
    (candidate) => candidate.submissionId === submissionId && candidate.authorSeat === seat,
  );
  const entry = roomContext.state.chains
    .flatMap((chain) => chain.entries)
    .find(
      (candidate): candidate is PictionaryDrawingEntry =>
        candidate.kind === 'drawing' &&
        candidate.authorSeat === seat &&
        candidate.media.objectKey === objectKey,
    );
  const entryId = reservation?.entryId ?? entry?.id;
  if (entryId === undefined) return failMediaRequest(409, 'PICTIONARY_UPLOAD_INVALID');
  const uploadResult = await readDrawingUpload(c.req.raw, PICTIONARY_DRAWING_UPLOAD_OPTIONS);
  if ('status' in uploadResult) return failMediaRequest(uploadResult.status, uploadResult.reason);
  const upload = uploadResult;
  if (
    entry !== undefined &&
    (entry.media.sha256 !== upload.sha256 || entry.media.byteLength !== upload.bytes.byteLength)
  ) {
    return failMediaRequest(409, 'PICTIONARY_UPLOAD_CONFLICT');
  }
  await putImmutableDrawing(c.env.GAME_MEDIA, objectKey, entryId, upload, {
    conflictReason: 'PICTIONARY_UPLOAD_CONFLICT',
    writeFailedMessage: 'Conditional R2 write failed without an existing object',
  });

  const dispatched = await callDurableObject(() =>
    roomContext.stub.dispatchInternalCommand({
      roomCode: roomContext.room.roomCode,
      roomId: roomContext.room.roomId,
      creationId: roomContext.room.creationId,
      commandId: `pictionary-media-commit:${submissionId}`,
      systemActorId: `pictionary-media-route:${submissionId}`,
      command: {
        type: 'pictionary.drawing.commit',
        submissionId,
        media: {
          objectKey,
          contentType: DRAWING_PNG_CONTENT_TYPE,
          width: PICTIONARY_DRAWING_WIDTH,
          height: PICTIONARY_DRAWING_HEIGHT,
          byteLength: upload.bytes.byteLength,
          sha256: upload.sha256,
        },
      },
    }),
  );
  if (dispatched.kind === 'unavailable') {
    await c.env.GAME_MEDIA.delete(objectKey);
    return c.json({ success: false as const, reason: dispatched.reason }, 404);
  }
  if (dispatched.result.kind === 'rejected') {
    if (entry === undefined) await c.env.GAME_MEDIA.delete(objectKey);
    return c.json(dispatched.result, 409);
  }
  return c.json(dispatched.result, 200);
});

pictionaryMediaRoutes.get('/:roomCode/media/:entryId', requireAuth, async (c) => {
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  const seat = mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  const entryId = c.req.param('entryId');
  const entry = findDrawingEntry(roomContext.state, entryId);
  if (entry === null) return failMediaRequest(404, 'PICTIONARY_MEDIA_NOT_FOUND');
  if (!canReadDrawing(roomContext.state, seat, entryId)) {
    return failMediaRequest(403, 'PICTIONARY_MEDIA_FORBIDDEN');
  }
  const object = await c.env.GAME_MEDIA.get(entry.media.objectKey);
  if (object === null) return failMediaRequest(500, 'PICTIONARY_MEDIA_MISSING');
  return buildDrawingGetResponse(object, c.req.header('if-none-match'));
});
