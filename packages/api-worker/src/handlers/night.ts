/**
 * handlers/night — night-phase Hono routes (Workers edition)
 *
 * Thin router layer: zod validation -> DO RPC -> error handling -> response.
 * Night logic runs inside the DO (GameRoom).
 *
 * @throws 400 — zod validation failure (VALIDATION_ERROR) or DO returns success:false
 * @throws 503 — callDO detects a DO retryable error
 * @throws 429 — callDO detects DO overloaded
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { roomCodeSchema } from '../schemas/game';
import {
  audioGateSchema,
  groupConfirmAckSchema,
  nightActionSchema,
  wolfRobotViewedSchema,
} from '../schemas/night';
import { callDO, getGameRoomStub, jsonBody, resultToStatus } from './shared';

/** Night action routes. */
export const nightRoutes = new Hono<AppEnv>();

// ── Night handlers ──────────────────────────────────────────────────────────

nightRoutes.post('/action', jsonBody(nightActionSchema), async (c) => {
  const { roomCode, seat, role, target, extra } = c.req.valid('json');
  const result = await callDO(() => {
    const stub = getGameRoomStub(c.env, roomCode, c.req.raw);
    return stub.submitAction(seat, role as RoleId, target ?? null, extra);
  });
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/audio-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).audioAck());
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/audio-gate', jsonBody(audioGateSchema), async (c) => {
  const { roomCode, isPlaying } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).audioGate(isPlaying),
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/progression', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).progression());
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/reveal-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).revealAck());
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/wolf-robot-viewed', jsonBody(wolfRobotViewedSchema), async (c) => {
  const { roomCode, seat } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).wolfRobotViewed(seat),
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/group-confirm-ack', jsonBody(groupConfirmAckSchema), async (c) => {
  const { roomCode, seat, userId } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).groupConfirmAck(seat, userId),
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/mark-bots-group-confirmed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).markBotsGroupConfirmed(),
  );
  return c.json(result, resultToStatus(result));
});
