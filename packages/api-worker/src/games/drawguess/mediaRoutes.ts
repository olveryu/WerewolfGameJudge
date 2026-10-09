/**
 * DrawGuess 终稿画作上传与读取路由（需登录）。
 *
 * PUT /:roomCode/submissions/:submissionId — 画手在 roundEnd 上传终稿 PNG，
 *   校验通过后写入 R2，再经内部命令 drawguess.drawing.committed 入册。
 * GET /:roomCode/media/:entryId — 读取本轮已提交的终稿 PNG（仅 roundEnd）。
 *
 * @throws 400 PNG 数据非法，401 未登录，403 无权访问，404 房间/媒体不存在，
 *   409 预留过期或内容冲突，413 超过大小上限。
 */

import {
  DRAWGUESS_STATE_CODEC,
  type DrawGuessState,
  getDrawGuessUserSeat,
  isDrawGuessBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { AppEnv, Env } from '../../env';
import { requireAuth } from '../../features/auth/tokenAuth';
import { callDurableObject } from '../../platform/http/callDurableObject';
import { type ActiveRoomDirectoryEntry, findActiveRoom } from '../../platform/room/roomDirectory';
import { type GameRoomStub, getGameRoomStub } from '../../platform/room/roomStub';
import {
  DRAWGUESS_PNG_CONTENT_TYPE,
  type DrawGuessDrawingUpload,
  readDrawGuessDrawingUpload,
} from './mediaValidation';

const PRIVATE_MEDIA_CACHE_CONTROL = 'private, max-age=3600';

const controlledSeatQuerySchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(z.number().int().min(0))
  .optional();

interface DrawGuessRoomContext {
  readonly room: ActiveRoomDirectoryEntry;
  readonly state: DrawGuessState;
  readonly stub: GameRoomStub;
}

function fail(status: 400 | 403 | 404 | 409 | 413 | 415 | 500, reason: string): never {
  throw new HTTPException(status, { message: reason });
}

async function readDrawGuessRoom(
  env: Env,
  request: Request,
  roomCode: string,
): Promise<DrawGuessRoomContext> {
  const room = await findActiveRoom(env, roomCode);
  if (room === null) return fail(404, '房间不存在');
  if (room.gameType !== 'drawguess') return fail(409, '房间游戏类型不匹配');
  const stub = getGameRoomStub(env, room.roomId, request);
  const snapshot = await callDurableObject(() =>
    stub.getSnapshot({
      roomCode: room.roomCode,
      roomId: room.roomId,
      creationId: room.creationId,
    }),
  );
  if (snapshot === null) return fail(404, '房间状态不存在');
  return { room, state: DRAWGUESS_STATE_CODEC.parse(snapshot.state), stub };
}

function findUserSeat(state: DrawGuessState, userId: string): number | null {
  return getDrawGuessUserSeat(state, userId);
}

function parseControlledSeat(value: string | undefined): number | null {
  const parsed = controlledSeatQuerySchema.safeParse(value);
  if (!parsed.success) return fail(400, '代传席位参数无效');
  return parsed.data ?? null;
}

/** 画手本人上传；机器人画手席位仅房主可接管代传。 */
function resolveMediaSeat(
  state: DrawGuessState,
  userId: string,
  controlledSeat: number | null,
): number | null {
  if (controlledSeat === null) return findUserSeat(state, userId);
  if (userId !== state.hostUserId) return fail(403, '只有房主可以代传画作');
  if (!isDrawGuessBotSeat(state, controlledSeat)) {
    return fail(403, '只能代传机器人席位的画作');
  }
  return controlledSeat;
}

function buildObjectKey(
  room: ActiveRoomDirectoryEntry,
  state: DrawGuessState,
  submissionId: string,
): string {
  if (state.phase.kind !== 'roundEnd') return fail(409, '当前不是结算阶段');
  return `drawguess/${room.creationId}/${state.phaseRevision}/turn-${state.turnIndex}/${submissionId}.png`;
}

function assertMatchingObject(object: R2Object, upload: DrawGuessDrawingUpload): void {
  if (object.size !== upload.bytes.byteLength || object.customMetadata?.sha256 !== upload.sha256) {
    fail(409, '已上传的画作内容不一致');
  }
}

async function putImmutableDrawing(
  bucket: R2Bucket,
  objectKey: string,
  entryId: string,
  upload: DrawGuessDrawingUpload,
): Promise<void> {
  const stored = await bucket.put(objectKey, upload.bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: DRAWGUESS_PNG_CONTENT_TYPE },
    customMetadata: { entryId, sha256: upload.sha256 },
    sha256: upload.sha256Digest,
  });
  if (stored !== null) return;
  const existing = await bucket.head(objectKey);
  if (existing === null) throw new Error('R2 条件写入失败且无已存在对象');
  assertMatchingObject(existing, upload);
}

export const drawGuessMediaRoutes = new Hono<AppEnv>();

drawGuessMediaRoutes.put('/:roomCode/submissions/:submissionId', requireAuth, async (c) => {
  const roomContext = await readDrawGuessRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = parseControlledSeat(c.req.query('controlledSeat'));
  const seat = resolveMediaSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return fail(403, '请先入座');
  if (roomContext.state.phase.kind !== 'roundEnd') return fail(409, '当前不是结算阶段');
  const submissionId = c.req.param('submissionId');
  const reservation = roomContext.state.phase.reservation;
  if (
    reservation === null ||
    reservation.submissionId !== submissionId ||
    reservation.authorSeat !== seat ||
    reservation.turnIndex !== roomContext.state.turnIndex
  ) {
    return fail(409, '上传预留无效或已过期');
  }
  const objectKey = buildObjectKey(roomContext.room, roomContext.state, submissionId);
  const committed = roomContext.state.phase.pngEntry;
  if (committed !== null && committed.objectKey === objectKey) {
    return fail(409, '本轮画作已提交');
  }
  const upload = await readDrawGuessDrawingUpload(c.req.raw);
  if ('status' in upload) {
    return fail(upload.status, upload.reason);
  }
  await putImmutableDrawing(c.env.GAME_MEDIA, objectKey, reservation.entryId, upload);

  const dispatched = await callDurableObject(() =>
    roomContext.stub.dispatchInternalCommand({
      roomCode: roomContext.room.roomCode,
      roomId: roomContext.room.roomId,
      creationId: roomContext.room.creationId,
      commandId: `drawguess-media-commit:${submissionId}`,
      systemActorId: `drawguess-media-route:${submissionId}`,
      command: {
        type: 'drawguess.drawing.committed',
        turnIndex: roomContext.state.turnIndex,
        submissionId,
        objectKey,
        byteLength: upload.bytes.byteLength,
        sha256: upload.sha256,
      },
    }),
  );
  if (dispatched.kind === 'unavailable') {
    await c.env.GAME_MEDIA.delete(objectKey);
    return c.json({ success: false as const, reason: dispatched.reason }, 404);
  }
  if (dispatched.result.kind === 'rejected') {
    if (committed === null) await c.env.GAME_MEDIA.delete(objectKey);
    return c.json(dispatched.result, 409);
  }
  return c.json(dispatched.result, 200);
});

drawGuessMediaRoutes.get('/:roomCode/media/:entryId', requireAuth, async (c) => {
  const roomContext = await readDrawGuessRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = parseControlledSeat(c.req.query('controlledSeat'));
  const seat = resolveMediaSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return fail(403, '请先入座');
  if (roomContext.state.phase.kind !== 'roundEnd') return fail(404, '画作不存在');
  const entryId = c.req.param('entryId');
  const reservation = roomContext.state.phase.reservation;
  const pngEntry = roomContext.state.phase.pngEntry;
  if (pngEntry === null || reservation === null || reservation.entryId !== entryId) {
    return fail(404, '画作不存在');
  }
  const object = await c.env.GAME_MEDIA.get(pngEntry.objectKey);
  if (object === null) return fail(500, '画作数据缺失');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', DRAWGUESS_PNG_CONTENT_TYPE);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', PRIVATE_MEDIA_CACHE_CONTROL);
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  if (c.req.header('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { status: 200, headers });
});
