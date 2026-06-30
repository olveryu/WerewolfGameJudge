/**
 * handlers/gameControl — game lifecycle Hono routes (Workers)
 *
 * Thin router layer: zod validation → DO RPC → error handling → return response.
 * Game logic executes inside the DO (GameRoom).
 *
 * @throws 400 — zod validation failed or DO returned success:false
 * @throws 503/429 — callDO detected DO retryable/overloaded
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { roomParticipants, rooms } from '../db/schema';
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

/** Game control routes (assign / restart / bot, etc.). */
export const gameRoutes = new Hono<AppEnv>();

// ── Simple no-arg handlers (roomCode only) ──────────────────────────────────

gameRoutes.post('/assign', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).assignRoles());
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/fill-bots', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).fillWithBots());
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/mark-bots-viewed', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).markAllBotsViewed(),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/clear-seats', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).clearAllSeats());
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/restart', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).restartGame());
  return c.json(result, resultToStatus(result));
});

// ── Parameterized handlers ──────────────────────────────────────────────────

gameRoutes.post('/seat', jsonBody(seatActionSchema), async (c) => {
  const { roomCode, ...params } = c.req.valid('json');

  const result = await callDO(() => {
    const stub = getGameRoomStub(c.env, roomCode, c.req.raw);
    return stub.seat(params);
  });

  // Record participant in D1 on successful join (fire-and-forget, idempotent)
  if (result.success && params.action === 'sit') {
    const db = createDb(c.env.DB);
    c.executionCtx.waitUntil(
      db
        .insert(roomParticipants)
        .values({
          roomCode,
          userId: params.userId,
          joinedAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .execute(),
    );
  }

  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/start', jsonBody(roomCodeSchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const result = await callDO(() => getGameRoomStub(c.env, roomCode, c.req.raw).startNight());

  // Record the game start in D1 on the Ready→Ongoing transition (fire-and-forget).
  // startNight succeeds exactly once per game (re-calls return invalid_status), so this
  // counter is restart-proof and survives DO state resets.
  if (result.success) {
    const db = createDb(c.env.DB);
    c.executionCtx.waitUntil(
      db
        .update(rooms)
        .set({
          gamesStarted: sql`${rooms.gamesStarted} + 1`,
          lastStartedAt: new Date().toISOString(),
        })
        .where(eq(rooms.code, roomCode))
        .execute(),
    );
  }

  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/update-template', jsonBody(updateTemplateSchema), async (c) => {
  const { roomCode, templateRoles, rules } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).updateTemplate(templateRoles as RoleId[], rules),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/view-role', jsonBody(viewRoleSchema), async (c) => {
  const { roomCode, userId, seat } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).viewRole(userId, seat),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/share-review', jsonBody(shareReviewSchema), async (c) => {
  const { roomCode, allowedSeats } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).shareReview(allowedSeats),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/update-profile', jsonBody(updateProfileRouteSchema), async (c) => {
  const { roomCode, ...payload } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).updateProfile(payload),
  );
  return c.json(result, resultToStatus(result));
});

// ── Board Nomination handlers ───────────────────────────────────────────────

gameRoutes.post('/board-nominate', jsonBody(boardNominateSchema), async (c) => {
  const { roomCode, userId, displayName, roles } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).boardNominate(
      userId,
      displayName,
      roles as RoleId[],
    ),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/board-upvote', jsonBody(boardUpvoteSchema), async (c) => {
  const { roomCode, userId, targetUserId } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).boardUpvote(userId, targetUserId),
  );
  return c.json(result, resultToStatus(result));
});

gameRoutes.post('/board-withdraw', jsonBody(boardWithdrawSchema), async (c) => {
  const { roomCode, userId } = c.req.valid('json');
  const result = await callDO(() =>
    getGameRoomStub(c.env, roomCode, c.req.raw).boardWithdraw(userId),
  );
  return c.json(result, resultToStatus(result));
});
