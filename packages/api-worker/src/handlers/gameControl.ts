/**
 * handlers/gameControl — 游戏生命周期 Hono routes (Workers 版)
 *
 * Thin router 层：zod 校验 → DO RPC → 错误处理 → 返回响应。
 * 游戏逻辑在 DO (GameRoom) 内部执行。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Hono } from 'hono';

import type { GameActionResult } from '../durableObjects/gameProcessor';
import type { AppEnv } from '../env';
import {
  boardNominateSchema,
  boardUpvoteSchema,
  boardWithdrawSchema,
  roomCodeSchema,
  seatActionSchema,
  setAnimationSchema,
  shareReviewSchema,
  updateProfileRouteSchema,
  updateTemplateSchema,
  viewRoleSchema,
} from '../schemas/game';
import { callDO, getGameRoomStub, jsonBody, resultToStatus } from './shared';

export const gameRoutes = new Hono<AppEnv>();

// ── Simple no-arg handlers (roomCode only) ──────────────────────────────────

gameRoutes.post('/assign', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).assignRoles());
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/fill-bots', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).fillWithBots());
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/mark-bots-viewed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).markAllBotsViewed());
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/clear-seats', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).clearAllSeats());
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/restart', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).restartGame());
  return c.json(result, resultToStatus(result as GameActionResult));
});

// ── Parameterized handlers ──────────────────────────────────────────────────

gameRoutes.post('/seat', jsonBody(seatActionSchema), async (c) => {
  const {
    roomCode,
    action,
    uid,
    seat,
    targetSeat,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    level,
  } = c.req.valid('json');

  const result = await callDO(() => {
    const stub = getGameRoomStub(c.env, roomCode);
    return stub.seat(
      action,
      uid,
      seat ?? null,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
      targetSeat,
      level,
    );
  });
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/set-animation', jsonBody(setAnimationSchema), async (c) => {
  const { roomCode, animation } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).setAnimation(animation));
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/start', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).startNight());
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/update-template', jsonBody(updateTemplateSchema), async (c) => {
  const { roomCode, templateRoles } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode).updateTemplate(templateRoles as RoleId[]),
  );
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/view-role', jsonBody(viewRoleSchema), async (c) => {
  const { roomCode, uid, seat } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).viewRole(uid, seat));
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/share-review', jsonBody(shareReviewSchema), async (c) => {
  const { roomCode, allowedSeats } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).shareReview(allowedSeats));
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/update-profile', jsonBody(updateProfileRouteSchema), async (c) => {
  const { roomCode, uid, displayName, avatarUrl, avatarFrame, seatFlair, nameStyle } =
    c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode).updateProfile(
      uid,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
    ),
  );
  return c.json(result, resultToStatus(result as GameActionResult));
});

// ── Board Nomination handlers ───────────────────────────────────────────────

gameRoutes.post('/board-nominate', jsonBody(boardNominateSchema), async (c) => {
  const { roomCode, uid, displayName, roles } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode).boardNominate(uid, displayName, roles as RoleId[]),
  );
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/board-upvote', jsonBody(boardUpvoteSchema), async (c) => {
  const { roomCode, uid, targetUid } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).boardUpvote(uid, targetUid));
  return c.json(result, resultToStatus(result as GameActionResult));
});

gameRoutes.post('/board-withdraw', jsonBody(boardWithdrawSchema), async (c) => {
  const { roomCode, uid } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).boardWithdraw(uid));
  return c.json(result, resultToStatus(result as GameActionResult));
});
