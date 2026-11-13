/**
 * Authenticated Pictionary drawing upload and retrieval routes.
 *
 * @throws 400 for malformed PNG data, 401 for missing authentication, 403 for
 * disallowed media access, 404 for missing rooms/media, 409 for stale reservations, 410 for
 * a filed drawing whose stored object expired with the bucket lifecycle, and 413 for
 * oversized uploads.
 *
 * Stroke replays: a client stages `<drawing key>.strokes.json` with the replay
 * PUT before uploading the PNG; the PNG route then validates the staged object
 * and commits its server-derived hash, size and duration with the drawing. The
 * PNG stays authoritative: without a staged replay (old clients, failed replay
 * upload) the drawing commits with `replay: null`, while a staged object that
 * fails validation is an explicit 500, never a silent fallback. Both objects
 * are written immutably, and identical retries succeed while different bytes
 * get 409, including after the entry is final.
 *
 * Cleanup lifecycle (deliberate): these routes never delete objects. A rejected
 * or lost commit, or a replay write racing its PNG commit, leaves an orphan
 * that the bucket's object lifecycle expires; deleting here could remove
 * an object a concurrent or earlier request already committed.
 */

import {
  getPictionaryReplayDuration,
  getPictionaryTaskForSeat,
  getPictionaryUserSeat,
  isBotSeat,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_REPLAY_SCHEMA,
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
  readBoundedBody,
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

function replayKey(objectKey: string): string {
  return objectKey.replace(/\.png$/, '.strokes.json');
}

async function validateReplayBytes(bytes: Uint8Array<ArrayBuffer>, invalidStatus: 400 | 500 = 400) {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return failMediaRequest(invalidStatus, 'PICTIONARY_REPLAY_INVALID');
  }
  const parsed = PICTIONARY_DRAWING_REPLAY_SCHEMA.safeParse(value);
  if (!parsed.success) return failMediaRequest(invalidStatus, 'PICTIONARY_REPLAY_INVALID');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return { bytes, digest, sha256, durationMs: getPictionaryReplayDuration(parsed.data) };
}

async function readStagedReplay(bucket: R2Bucket, objectKey: string) {
  const object = await bucket.get(objectKey);
  if (object === null) return null;
  if (object.size > 1024 * 1024) return failMediaRequest(500, 'PICTIONARY_REPLAY_INVALID');
  const replay = await validateReplayBytes(new Uint8Array(await object.arrayBuffer()), 500);
  if (object.size !== replay.bytes.byteLength || object.customMetadata?.sha256 !== replay.sha256) {
    return failMediaRequest(500, 'PICTIONARY_REPLAY_INVALID');
  }
  return {
    objectKey,
    byteLength: replay.bytes.byteLength,
    sha256: replay.sha256,
    durationMs: replay.durationMs,
  };
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

pictionaryMediaRoutes.put('/:roomCode/submissions/:submissionId/replay', requireAuth, async (c) => {
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  const seat = mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return failMediaRequest(403, 'NOT_SEATED');
  const submissionId = c.req.param('submissionId');
  const pngKey = buildObjectKey(roomContext.room, roomContext.state, submissionId);
  const objectKey = replayKey(pngKey);
  const reservation = roomContext.state.reservations.find(
    (candidate) => candidate.submissionId === submissionId && candidate.authorSeat === seat,
  );
  const entry = roomContext.state.chains
    .flatMap((chain) => chain.entries)
    .find(
      (candidate): candidate is PictionaryDrawingEntry =>
        candidate.kind === 'drawing' &&
        candidate.authorSeat === seat &&
        candidate.media.objectKey === pngKey,
    );
  if (reservation === undefined && entry === undefined)
    return failMediaRequest(409, 'PICTIONARY_UPLOAD_INVALID');
  if (c.req.header('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    return failMediaRequest(415, 'PICTIONARY_REPLAY_CONTENT_TYPE_INVALID');
  }
  const body = await readBoundedBody(c.req.raw, {
    ...PICTIONARY_DRAWING_UPLOAD_OPTIONS,
    maxBytes: 1024 * 1024,
  });
  if ('status' in body) return failMediaRequest(body.status, body.reason);
  const replay = await validateReplayBytes(body);
  if (entry !== undefined) {
    const stored = entry.media.replay;
    if (
      stored === null ||
      stored.objectKey !== objectKey ||
      stored.byteLength !== body.byteLength ||
      stored.sha256 !== replay.sha256 ||
      stored.durationMs !== replay.durationMs
    ) {
      return failMediaRequest(409, 'PICTIONARY_UPLOAD_CONFLICT');
    }
    return c.json({ success: true as const });
  }
  const stored = await c.env.GAME_MEDIA.put(objectKey, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { sha256: replay.sha256 },
    sha256: replay.digest,
  });
  if (stored === null) {
    const existing = await c.env.GAME_MEDIA.head(objectKey);
    if (existing === null)
      throw new Error('Conditional replay write failed without an existing object');
    if (existing.size !== body.byteLength || existing.customMetadata?.sha256 !== replay.sha256)
      return failMediaRequest(409, 'PICTIONARY_UPLOAD_CONFLICT');
  }
  return c.json({ success: true as const });
});

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
  const replay =
    entry === undefined
      ? await readStagedReplay(c.env.GAME_MEDIA, replayKey(objectKey))
      : entry.media.replay;

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
          replay,
        },
      },
    }),
  );
  if (dispatched.kind === 'unavailable') {
    return c.json({ success: false as const, reason: dispatched.reason }, 404);
  }
  if (dispatched.result.kind === 'rejected') {
    return c.json(dispatched.result, 409);
  }
  return c.json(dispatched.result, 200);
});

pictionaryMediaRoutes.get('/:roomCode/media/:entryId/replay', requireAuth, async (c) => {
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  const entry = findDrawingEntry(roomContext.state, c.req.param('entryId'));
  if (entry === null || entry.media.replay === null)
    return failMediaRequest(404, 'PICTIONARY_MEDIA_NOT_FOUND');
  if (
    roomContext.state.phase !== 'gallery' &&
    roomContext.state.phase !== 'ended' &&
    roomContext.state.phase !== 'aborted'
  ) {
    return failMediaRequest(403, 'PICTIONARY_MEDIA_FORBIDDEN');
  }
  const object = await c.env.GAME_MEDIA.get(entry.media.replay.objectKey);
  if (object === null) return failMediaRequest(410, 'PICTIONARY_MEDIA_EXPIRED');
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
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
  // A filed drawing whose object storage lifecycle expired is gone, not a server fault.
  if (object === null) return failMediaRequest(410, 'PICTIONARY_MEDIA_EXPIRED');
  return buildDrawingGetResponse(object, c.req.header('if-none-match'));
});
