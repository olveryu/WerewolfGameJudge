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
  isBotSeat,
} from '@game-judge/game-engine/games/drawguess/public';
import { Hono } from 'hono';

import type { AppEnv } from '../../env';
import { requireAuth } from '../../features/auth/tokenAuth';
import { callDurableObject } from '../../platform/http/callDurableObject';
import {
  buildDrawingGetResponse,
  type DrawingUploadOptions,
  failMediaRequest,
  putImmutableDrawing,
  readDrawingUpload,
} from '../../platform/room/mediaDrawing';
import { createMediaRoomAccess } from '../../platform/room/mediaRoomAccess';
import type { ActiveRoomDirectoryEntry } from '../../platform/room/roomDirectory';

/** V1 画作规格固定：1024×768 PNG，单文件最大 2 MiB。 */
const DRAWGUESS_DRAWING_UPLOAD_OPTIONS: DrawingUploadOptions = {
  width: 1024,
  height: 768,
  maxBytes: 2 * 1024 * 1024,
  reasons: {
    invalidContentLength: '请求长度头无效',
    drawingTooLarge: '画作超过 2 MiB 上限',
    bodyRequired: '缺少画作数据',
    invalidBody: '画作数据读取失败',
    lengthMismatch: '请求长度与实际数据不一致',
    invalidPng: 'PNG 文件签名无效',
    invalidDimensions: '画作尺寸必须为 1024×768',
    contentTypeInvalid: '只接受 image/png',
  },
};

const mediaRoomAccess = createMediaRoomAccess({
  codec: DRAWGUESS_STATE_CODEC,
  getUserSeat: getDrawGuessUserSeat,
  isBotSeat: (state, seat) => isBotSeat(state.roster, seat),
  reasons: {
    roomNotFound: '房间不存在',
    roomGameTypeMismatch: '房间游戏类型不匹配',
    roomStateNotFound: '房间状态不存在',
    controlledSeatInvalid: '代传席位参数无效',
    notHost: '只有房主可以代传画作',
    controlledSeatNotBot: '只能代传机器人席位的画作',
  },
});

function buildObjectKey(
  room: ActiveRoomDirectoryEntry,
  state: DrawGuessState,
  submissionId: string,
): string {
  if (state.phase.kind !== 'roundEnd') return failMediaRequest(409, '当前不是结算阶段');
  return `drawguess/${room.creationId}/${state.phaseRevision}/turn-${state.turnIndex}/${submissionId}.png`;
}

export const drawGuessMediaRoutes = new Hono<AppEnv>();

drawGuessMediaRoutes.put('/:roomCode/submissions/:submissionId', requireAuth, async (c) => {
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  const seat = mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return failMediaRequest(403, '请先入座');
  if (roomContext.state.phase.kind !== 'roundEnd') return failMediaRequest(409, '当前不是结算阶段');
  const submissionId = c.req.param('submissionId');
  const reservation = roomContext.state.phase.reservation;
  if (
    reservation === null ||
    reservation.submissionId !== submissionId ||
    reservation.authorSeat !== seat ||
    reservation.turnIndex !== roomContext.state.turnIndex
  ) {
    return failMediaRequest(409, '上传预留无效或已过期');
  }
  const objectKey = buildObjectKey(roomContext.room, roomContext.state, submissionId);
  const committed = roomContext.state.phase.pngEntry;
  if (committed !== null && committed.objectKey === objectKey) {
    return failMediaRequest(409, '本轮画作已提交');
  }
  const upload = await readDrawingUpload(c.req.raw, DRAWGUESS_DRAWING_UPLOAD_OPTIONS);
  if ('status' in upload) {
    return failMediaRequest(upload.status, upload.reason);
  }
  await putImmutableDrawing(c.env.GAME_MEDIA, objectKey, reservation.entryId, upload, {
    conflictReason: '已上传的画作内容不一致',
    writeFailedMessage: 'R2 条件写入失败且无已存在对象',
  });

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
  const roomContext = await mediaRoomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = mediaRoomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  const seat = mediaRoomAccess.resolveSeat(roomContext.state, c.var.userId, controlledSeat);
  if (seat === null) return failMediaRequest(403, '请先入座');
  if (roomContext.state.phase.kind !== 'roundEnd') return failMediaRequest(404, '画作不存在');
  const entryId = c.req.param('entryId');
  const reservation = roomContext.state.phase.reservation;
  const pngEntry = roomContext.state.phase.pngEntry;
  if (pngEntry === null || reservation === null || reservation.entryId !== entryId) {
    return failMediaRequest(404, '画作不存在');
  }
  const object = await c.env.GAME_MEDIA.get(pngEntry.objectKey);
  if (object === null) return failMediaRequest(500, '画作数据缺失');
  return buildDrawingGetResponse(object, c.req.header('if-none-match'));
});
