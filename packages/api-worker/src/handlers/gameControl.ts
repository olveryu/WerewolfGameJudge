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
  const result = await callDO(
    () => getGameRoomStub(c.env, roomCode, c.req.raw).assignRoles() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/fill-bots', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(
    () => getGameRoomStub(c.env, roomCode, c.req.raw).fillWithBots() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/mark-bots-viewed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).markAllBotsViewed() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/clear-seats', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(
    () => getGameRoomStub(c.env, roomCode, c.req.raw).clearAllSeats() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/restart', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(
    () => getGameRoomStub(c.env, roomCode, c.req.raw).restartGame() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

// ── Parameterized handlers ──────────────────────────────────────────────────

gameRoutes.post('/seat', jsonBody(seatActionSchema), async (c) => {
  const { roomCode, ...params } = c.req.valid('json');

  const result = await callDO(() => {
    const stub = getGameRoomStub(c.env, roomCode, c.req.raw);
    return stub.seat(params) as Promise<GameActionResult>;
  });
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/start', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(
    () => getGameRoomStub(c.env, roomCode, c.req.raw).startNight() as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/update-template', jsonBody(updateTemplateSchema), async (c) => {
  const { roomCode, templateRoles } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).updateTemplate(
        templateRoles as RoleId[],
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/view-role', jsonBody(viewRoleSchema), async (c) => {
  const { roomCode, userId, seat } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).viewRole(
        userId,
        seat,
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/share-review', jsonBody(shareReviewSchema), async (c) => {
  const { roomCode, allowedSeats } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).shareReview(
        allowedSeats,
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/update-profile', jsonBody(updateProfileRouteSchema), async (c) => {
  const { roomCode, ...payload } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).updateProfile(
        payload,
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

// ── Board Nomination handlers ───────────────────────────────────────────────

gameRoutes.post('/board-nominate', jsonBody(boardNominateSchema), async (c) => {
  const { roomCode, userId, displayName, roles } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).boardNominate(
        userId,
        displayName,
        roles as RoleId[],
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/board-upvote', jsonBody(boardUpvoteSchema), async (c) => {
  const { roomCode, userId, targetUserId } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).boardUpvote(
        userId,
        targetUserId,
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/board-withdraw', jsonBody(boardWithdrawSchema), async (c) => {
  const { roomCode, userId } = c.req.valid('json');
  const result = await callDO(
    () =>
      getGameRoomStub(c.env, roomCode, c.req.raw).boardWithdraw(
        userId,
      ) as Promise<GameActionResult>,
  );
  return c.json(result, resultToStatus(result));
});
