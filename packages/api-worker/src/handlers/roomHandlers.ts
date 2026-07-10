/** Authenticated generic room creation, command, read, and deletion routes. */

import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_NO_STATE,
  REASON_ROOM_CODE_CONFLICT,
  REASON_ROOM_INITIALIZATION_CONFLICT,
} from '@werewolf/game-engine/platform/protocol/reasons';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { rooms } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { createRoomInstanceId, findRoomInstance } from '../platform/room/roomDirectory';
import { createRoomSchema, roomCodeBodySchema, roomCommandSchema } from '../schemas/room';
import { callDO, getGameRoomStub, jsonBody } from './shared';

const log = createLogger('room');

/** Room management and the single public game-command endpoint. */
export const roomRoutes = new Hono<AppEnv>();

roomRoutes.post('/create', requireAuth, jsonBody(createRoomSchema), async (c) => {
  const db = createDb(c.env.DB);
  const hostUserId = c.var.userId;
  const input = c.req.valid('json');
  const createdAt = new Date().toISOString();
  const roomInstanceId = createRoomInstanceId(c.env);

  const inserted = await db
    .insert(rooms)
    .values({
      id: roomInstanceId,
      code: input.roomCode,
      hostUserId,
      createdAt,
      updatedAt: createdAt,
    })
    .onConflictDoNothing({ target: rooms.code })
    .returning({ id: rooms.id });
  if (inserted.length === 0) {
    return c.json({ success: false, reason: REASON_ROOM_CODE_CONFLICT }, 409);
  }

  try {
    const stub = getGameRoomStub(c.env, roomInstanceId, c.req.raw);
    const initialized = await callDO(() =>
      stub.initializeRoom({
        roomCode: input.roomCode,
        gameType: input.gameType,
        hostUserId,
        config: input.config,
        creationId: input.creationId,
      }),
    );
    if (!initialized.success) {
      await db.delete(rooms).where(eq(rooms.code, input.roomCode));
      const status = initialized.reason === REASON_ROOM_INITIALIZATION_CONFLICT ? 409 : 400;
      return c.json(initialized, status);
    }

    return c.json(
      {
        room: {
          roomCode: input.roomCode,
          gameType: input.gameType,
          hostUserId,
          createdAt,
        },
        snapshot: initialized.snapshot,
      },
      200,
    );
  } catch (error) {
    log.error('room initialization failed; removing uninitialized directory row', {
      roomCode: input.roomCode,
      creationId: input.creationId,
      error: error instanceof Error ? error.message : String(error),
    });
    await db.delete(rooms).where(eq(rooms.code, input.roomCode));
    throw error;
  }
});

roomRoutes.post('/command', requireAuth, jsonBody(roomCommandSchema), async (c) => {
  const input = c.req.valid('json');
  const room = await findRoomInstance(c.env, input.roomCode);
  if (room === null) {
    return c.json(
      { kind: 'rejected' as const, commandId: input.commandId, reason: REASON_NO_STATE },
      200,
    );
  }
  const stub = getGameRoomStub(c.env, room.roomInstanceId, c.req.raw);
  const dispatched = await callDO(() =>
    stub.dispatchUserCommand({
      roomCode: input.roomCode,
      commandId: input.commandId,
      actorUserId: c.var.userId,
      controlledSeat: input.controlledSeat,
      command: input.command,
    }),
  );
  const status =
    dispatched.result.kind === 'rejected' && dispatched.result.reason === REASON_COMMAND_ID_CONFLICT
      ? 409
      : 200;
  return c.json(dispatched.result, status);
});

roomRoutes.post('/get', jsonBody(roomCodeBodySchema), async (c) => {
  const db = createDb(c.env.DB);
  const { roomCode } = c.req.valid('json');
  const row = await db
    .select({
      code: rooms.code,
      hostUserId: rooms.hostUserId,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(eq(rooms.code, roomCode))
    .get();

  return c.json(
    {
      room:
        row === undefined
          ? null
          : {
              roomCode: row.code,
              hostUserId: row.hostUserId,
              createdAt: row.createdAt,
            },
    },
    200,
  );
});

roomRoutes.post('/delete', requireAuth, jsonBody(roomCodeBodySchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const room = await findRoomInstance(c.env, roomCode);
  if (room === null) {
    return c.json({ success: false as const, reason: REASON_NO_STATE }, 404);
  }
  const stub = getGameRoomStub(c.env, room.roomInstanceId, c.req.raw);
  const deletedRoom = await callDO(() => stub.deleteRoom(c.var.userId));
  if (!deletedRoom.success) {
    const status = deletedRoom.reason === REASON_NO_STATE ? 404 : 403;
    return c.json(deletedRoom, status);
  }

  const deletedDirectoryRows = await createDb(c.env.DB)
    .delete(rooms)
    .where(eq(rooms.code, roomCode))
    .returning({ id: rooms.id });
  if (deletedDirectoryRows.length !== 1) {
    throw new Error(`Deleted room ${roomCode} had no matching directory row`);
  }
  return c.json({ success: true }, 200);
});

roomRoutes.post('/state', jsonBody(roomCodeBodySchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const room = await findRoomInstance(c.env, roomCode);
  if (room === null) return c.json({ snapshot: null }, 200);
  const stub = getGameRoomStub(c.env, room.roomInstanceId, c.req.raw);
  const snapshot = await callDO(() => stub.getSnapshot());
  return c.json({ snapshot }, 200);
});

roomRoutes.post('/revision', jsonBody(roomCodeBodySchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const room = await findRoomInstance(c.env, roomCode);
  if (room === null) return c.json({ revision: null }, 200);
  const stub = getGameRoomStub(c.env, room.roomInstanceId, c.req.raw);
  const revision = await callDO(() => stub.getRevision());
  return c.json({ revision }, 200);
});
