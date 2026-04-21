/**
 * handlers/night — 夜晚阶段 Hono routes (Workers 版)
 *
 * Thin router 层：zod 校验 → DO RPC → 错误处理 → 返回响应。
 * 夜晚逻辑在 DO (GameRoom) 内部执行。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Hono } from 'hono';

import type { GameActionResult } from '../durableObjects/gameProcessor';
import type { AppEnv } from '../env';
import { roomCodeSchema } from '../schemas/game';
import {
  audioGateSchema,
  groupConfirmAckSchema,
  nightActionSchema,
  wolfRobotViewedSchema,
} from '../schemas/night';
import { callDO, getGameRoomStub, jsonBody, resultToStatus } from './shared';

export const nightRoutes = new Hono<AppEnv>();

// ── Night handlers ──────────────────────────────────────────────────────────

nightRoutes.post('/action', jsonBody(nightActionSchema), async (c) => {
  const { roomCode, seat, role, target, extra } = c.req.valid('json');
  const result = await callDO(() => {
    const stub = getGameRoomStub(c.env, roomCode);
    return stub.submitAction(seat, role as RoleId, target ?? null, extra);
  });
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/audio-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).audioAck());
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/audio-gate', jsonBody(audioGateSchema), async (c) => {
  const { roomCode, isPlaying } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).audioGate(isPlaying));
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/progression', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).progression());
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/reveal-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).revealAck());
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/wolf-robot-viewed', jsonBody(wolfRobotViewedSchema), async (c) => {
  const { roomCode, seat } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).wolfRobotViewed(seat));
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/group-confirm-ack', jsonBody(groupConfirmAckSchema), async (c) => {
  const { roomCode, seat, userId } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).groupConfirmAck(seat, userId));
  return c.json(result, resultToStatus(result as GameActionResult));
});

nightRoutes.post('/mark-bots-group-confirmed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode).markBotsGroupConfirmed());
  return c.json(result, resultToStatus(result as GameActionResult));
});
