/**
 * games/werewolf/handlers/nightRoutes — Werewolf night-phase Hono routes.
 *
 * Thin router layer: zod validation -> DO RPC -> error handling -> response.
 * Night logic runs inside the DO (GameRoom).
 *
 * @throws 400 — zod validation failure (VALIDATION_ERROR) or DO returns success:false
 * @throws 503 — callDO detects a DO retryable error
 * @throws 429 — callDO detects DO overloaded
 */

import { WEREWOLF_ACTION } from '@werewolf/game-engine/werewolf/actions';
import { Hono } from 'hono';

import type { AppEnv } from '../../../env';
import { dispatchEngineAction, jsonBody, resultToStatus } from '../../../handlers/shared';
import { roomCodeSchema } from '../schemas/gameSchemas';
import {
  audioGateSchema,
  groupConfirmAckSchema,
  nightActionSchema,
  wolfRobotViewedSchema,
} from '../schemas/nightSchemas';

/** Night action routes. */
export const nightRoutes = new Hono<AppEnv>();

// ── Night handlers ──────────────────────────────────────────────────────────

nightRoutes.post('/action', jsonBody(nightActionSchema), async (c) => {
  const { roomCode, seat, role, target, extra } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.SUBMIT_ACTION,
    {
      seat,
      role,
      target: target ?? null,
      extra,
    },
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/audio-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.AUDIO_ACK,
    {},
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/audio-gate', jsonBody(audioGateSchema), async (c) => {
  const { roomCode, isPlaying } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.AUDIO_GATE,
    {
      isPlaying,
    },
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/progression', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.PROGRESSION,
    {},
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/reveal-ack', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.REVEAL_ACK,
    {},
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/wolf-robot-viewed', jsonBody(wolfRobotViewedSchema), async (c) => {
  const { roomCode, seat } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.WOLF_ROBOT_VIEWED,
    {
      seat,
    },
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/group-confirm-ack', jsonBody(groupConfirmAckSchema), async (c) => {
  const { roomCode, seat, userId } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.GROUP_CONFIRM_ACK,
    {
      seat,
      userId,
    },
  );
  return c.json(result, resultToStatus(result));
});

nightRoutes.post('/mark-bots-group-confirmed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await dispatchEngineAction(
    c.env,
    roomCode,
    c.req.raw,
    WEREWOLF_ACTION.MARK_BOTS_GROUP_CONFIRMED,
    {},
  );
  return c.json(result, resultToStatus(result));
});
