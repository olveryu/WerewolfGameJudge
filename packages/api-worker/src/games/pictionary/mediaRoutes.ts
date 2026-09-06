/**
 * Authenticated Pictionary drawing upload and retrieval routes.
 *
 * @throws 400 for malformed PNG data, 401 for missing authentication, 403 for
 * non-members, 404 for missing rooms/media, 409 for stale reservations, and
 * 413 for oversized uploads.
 */

import {
  getPictionaryTaskForSeat,
  isPictionaryImplicitBotSeat,
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_MAX_BYTES,
  PICTIONARY_DRAWING_WIDTH,
  PICTIONARY_STATE_CODEC,
  type PictionaryDrawingEntry,
  type PictionaryDrawingReservation,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { AppEnv, Env } from '../../env';
import { requireAuth } from '../../features/auth/tokenAuth';
import { callDurableObject } from '../../platform/http/callDurableObject';
import { type ActiveRoomDirectoryEntry, findActiveRoom } from '../../platform/room/roomDirectory';
import { type GameRoomStub, getGameRoomStub } from '../../platform/room/roomStub';

const PNG_CONTENT_TYPE = 'image/png';
const PRIVATE_MEDIA_CACHE_CONTROL = 'private, max-age=3600';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const PNG_IHDR_CHUNK_TYPE = [73, 72, 68, 82] as const;
const controlledSeatQuerySchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(z.number().int().min(0))
  .optional();

interface PictionaryRoomContext {
  readonly room: ActiveRoomDirectoryEntry;
  readonly state: PictionaryState;
  readonly stub: GameRoomStub;
}

interface DrawingUpload {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly sha256: string;
  readonly sha256Digest: ArrayBuffer;
}

function fail(status: 400 | 403 | 404 | 409 | 413 | 415 | 500, reason: string): never {
  throw new HTTPException(status, { message: reason });
}

async function readPictionaryRoom(
  env: Env,
  request: Request,
  roomCode: string,
): Promise<PictionaryRoomContext> {
  const room = await findActiveRoom(env, roomCode);
  if (room === null) return fail(404, 'ROOM_NOT_FOUND');
  if (room.gameType !== 'pictionary') return fail(409, 'ROOM_GAME_TYPE_MISMATCH');
  const stub = getGameRoomStub(env, room.roomId, request);
  const snapshot = await callDurableObject(() =>
    stub.getSnapshot({
      roomCode: room.roomCode,
      roomId: room.roomId,
      creationId: room.creationId,
    }),
  );
  if (snapshot === null) return fail(404, 'ROOM_STATE_NOT_FOUND');
  return { room, state: PICTIONARY_STATE_CODEC.parse(snapshot.state), stub };
}

function findUserSeat(state: PictionaryState, userId: string): number | null {
  for (const occupant of Object.values(state.realSeats)) {
    if (occupant !== undefined && occupant.userId === userId) return occupant.seat;
  }
  return null;
}

function parseControlledSeat(value: string | undefined): number | null {
  const parsed = controlledSeatQuerySchema.safeParse(value);
  if (!parsed.success) return fail(400, 'CONTROLLED_SEAT_INVALID');
  return parsed.data ?? null;
}

function resolveMediaSeat(
  state: PictionaryState,
  userId: string,
  controlledSeat: number | null,
): number | null {
  if (controlledSeat === null) return findUserSeat(state, userId);
  if (userId !== state.hostUserId) return fail(403, 'NOT_HOST');
  if (!isPictionaryImplicitBotSeat(state, controlledSeat)) {
    return fail(403, 'CONTROLLED_SEAT_NOT_BOT');
  }
  return controlledSeat;
}

function requireUploadReservation(
  state: PictionaryState,
  seat: number | null,
  submissionId: string,
): PictionaryDrawingReservation {
  if (seat === null) return fail(403, 'NOT_SEATED');
  const reservation = state.reservations.find(
    (candidate) => candidate.submissionId === submissionId && candidate.authorSeat === seat,
  );
  if (reservation === undefined) return fail(409, 'PICTIONARY_UPLOAD_INVALID');
  if (Date.now() > reservation.uploadDeadlineAt) return fail(409, 'PICTIONARY_UPLOAD_EXPIRED');
  return reservation;
}

function parseContentLength(request: Request): number | null {
  const value = request.headers.get('content-length');
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) return fail(400, 'INVALID_CONTENT_LENGTH');
  const length = Number(value);
  if (!Number.isSafeInteger(length)) return fail(400, 'INVALID_CONTENT_LENGTH');
  if (length > PICTIONARY_DRAWING_MAX_BYTES) return fail(413, 'DRAWING_TOO_LARGE');
  return length;
}

async function readBoundedBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = parseContentLength(request);
  if (request.body === null) return fail(400, 'DRAWING_BODY_REQUIRED');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const chunk: unknown = result.value;
    if (!(chunk instanceof Uint8Array)) return fail(400, 'INVALID_DRAWING_BODY');
    byteLength += chunk.byteLength;
    if (byteLength > PICTIONARY_DRAWING_MAX_BYTES) {
      await reader.cancel('DRAWING_TOO_LARGE');
      return fail(413, 'DRAWING_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  if (byteLength === 0 || (declaredLength !== null && declaredLength !== byteLength)) {
    return fail(400, 'INVALID_CONTENT_LENGTH');
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function matchesBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function validatePng(bytes: Uint8Array): void {
  if (
    bytes.byteLength < 24 ||
    !matchesBytes(bytes, 0, PNG_SIGNATURE) ||
    !matchesBytes(bytes, 12, PNG_IHDR_CHUNK_TYPE)
  ) {
    fail(400, 'INVALID_PNG');
  }
  const dimensions = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    dimensions.getUint32(16) !== PICTIONARY_DRAWING_WIDTH ||
    dimensions.getUint32(20) !== PICTIONARY_DRAWING_HEIGHT
  ) {
    fail(400, 'INVALID_DRAWING_DIMENSIONS');
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readDrawingUpload(request: Request): Promise<DrawingUpload> {
  if (request.headers.get('content-type') !== PNG_CONTENT_TYPE) {
    return fail(415, 'DRAWING_CONTENT_TYPE_INVALID');
  }
  const bytes = await readBoundedBody(request);
  validatePng(bytes);
  const sha256Digest = await crypto.subtle.digest('SHA-256', bytes);
  return { bytes, sha256: toHex(new Uint8Array(sha256Digest)), sha256Digest };
}

function buildObjectKey(
  room: ActiveRoomDirectoryEntry,
  state: PictionaryState,
  submissionId: string,
): string {
  if (state.roundId === null) return fail(409, 'PICTIONARY_ROUND_NOT_ACTIVE');
  return `pictionary/${room.creationId}/${state.roundId}/${submissionId}.png`;
}

function assertMatchingObject(object: R2Object, upload: DrawingUpload): void {
  if (object.size !== upload.bytes.byteLength || object.customMetadata?.sha256 !== upload.sha256) {
    fail(409, 'PICTIONARY_UPLOAD_CONFLICT');
  }
}

async function putImmutableDrawing(
  bucket: R2Bucket,
  objectKey: string,
  entryId: string,
  upload: DrawingUpload,
): Promise<void> {
  const stored = await bucket.put(objectKey, upload.bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: PNG_CONTENT_TYPE },
    customMetadata: { entryId, sha256: upload.sha256 },
    sha256: upload.sha256Digest,
  });
  if (stored !== null) return;
  const existing = await bucket.head(objectKey);
  if (existing === null) throw new Error('Conditional R2 write failed without an existing object');
  assertMatchingObject(existing, upload);
}

function findDrawingEntry(state: PictionaryState, entryId: string): PictionaryDrawingEntry | null {
  for (const chain of state.chains) {
    const entry = chain.entries.find((candidate) => candidate.id === entryId);
    if (entry?.kind === 'drawing') return entry;
  }
  return null;
}

function canReadDrawing(
  state: PictionaryState,
  userId: string,
  seat: number | null,
  entryId: string,
): boolean {
  if (state.phase === 'gallery' || state.phase === 'ended') {
    return seat !== null || userId === state.hostUserId;
  }
  if (seat === null) return false;
  if (state.phase !== 'answering' && state.phase !== 'settling') return false;
  return getPictionaryTaskForSeat(state, seat)?.previousEntry?.id === entryId;
}

export const pictionaryMediaRoutes = new Hono<AppEnv>();

pictionaryMediaRoutes.put('/:roomCode/submissions/:submissionId', requireAuth, async (c) => {
  const roomContext = await readPictionaryRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = parseControlledSeat(c.req.query('controlledSeat'));
  const seat = resolveMediaSeat(roomContext.state, c.var.userId, controlledSeat);
  const reservation = requireUploadReservation(
    roomContext.state,
    seat,
    c.req.param('submissionId'),
  );
  const upload = await readDrawingUpload(c.req.raw);
  const objectKey = buildObjectKey(roomContext.room, roomContext.state, reservation.submissionId);
  await putImmutableDrawing(c.env.GAME_MEDIA, objectKey, reservation.entryId, upload);

  const dispatched = await callDurableObject(() =>
    roomContext.stub.dispatchInternalCommand({
      roomCode: roomContext.room.roomCode,
      roomId: roomContext.room.roomId,
      creationId: roomContext.room.creationId,
      commandId: `pictionary-media-commit:${reservation.submissionId}`,
      systemActorId: `pictionary-media-route:${reservation.submissionId}`,
      command: {
        type: 'pictionary.drawing.commit',
        submissionId: reservation.submissionId,
        media: {
          objectKey,
          contentType: PNG_CONTENT_TYPE,
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
    await c.env.GAME_MEDIA.delete(objectKey);
    return c.json(dispatched.result, 409);
  }
  return c.json(dispatched.result, 200);
});

pictionaryMediaRoutes.get('/:roomCode/media/:entryId', requireAuth, async (c) => {
  const roomContext = await readPictionaryRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = parseControlledSeat(c.req.query('controlledSeat'));
  const seat = resolveMediaSeat(roomContext.state, c.var.userId, controlledSeat);
  const entryId = c.req.param('entryId');
  const entry = findDrawingEntry(roomContext.state, entryId);
  if (entry === null) return fail(404, 'PICTIONARY_MEDIA_NOT_FOUND');
  if (!canReadDrawing(roomContext.state, c.var.userId, seat, entryId)) {
    return fail(403, 'PICTIONARY_MEDIA_FORBIDDEN');
  }
  const object = await c.env.GAME_MEDIA.get(entry.media.objectKey);
  if (object === null) return fail(500, 'PICTIONARY_MEDIA_MISSING');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', PNG_CONTENT_TYPE);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', PRIVATE_MEDIA_CACHE_CONTROL);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (c.req.header('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { status: 200, headers });
});
