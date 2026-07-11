/** Authenticated generic room creation, command, read, and deletion routes. */

import {
  REASON_NO_STATE,
  REASON_NOT_HOST,
  REASON_ROOM_EFFECTS_PENDING,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_ROOM_INSTANCE_MISMATCH,
} from '@werewolf/game-engine/platform/protocol/reasons';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import {
  beginRoomDeletion,
  claimRoomCreation,
  findActiveRoom,
  findRoomByCode,
  recordRoomSagaFailure,
  resolveActiveRoom,
  type RoomDirectoryRecord,
} from '../platform/room/roomDirectory';
import { getWorkerGameModule } from '../platform/room/roomRepository';
import { resumeRoomCreation, resumeRoomDeletion } from '../platform/room/roomSaga';
import { getGameRoomStub } from '../platform/room/roomStub';
import {
  createRoomSchema,
  roomCodeBodySchema,
  roomCommandSchema,
  roomLocatorBodySchema,
} from '../schemas/room';
import { callDO, jsonBody } from './shared';

const log = createLogger('room');

function isCreateSaga(room: RoomDirectoryRecord): boolean {
  return (
    room.status === 'creating' || (room.status === 'failed' && room.failureOperation === 'create')
  );
}

function isDeleteSaga(room: RoomDirectoryRecord): boolean {
  return (
    room.status === 'deleting' || (room.status === 'failed' && room.failureOperation === 'delete')
  );
}

/** Room management and the single public game-command endpoint. */
export const roomRoutes = new Hono<AppEnv>();

roomRoutes.post('/create', requireAuth, jsonBody(createRoomSchema), async (c) => {
  const hostUserId = c.var.userId;
  const input = c.req.valid('json');
  const module = getWorkerGameModule(input.gameType);
  const parsedConfig = module.parseCreateConfig(input.config);
  if (parsedConfig.kind === 'invalid') {
    return c.json({ success: false as const, reason: parsedConfig.reason }, 400);
  }

  const nowMs = Date.now();
  const claimed = await claimRoomCreation(
    c.env,
    {
      gameType: input.gameType,
      hostUserId,
      creationId: input.creationId,
      configJson: parsedConfig.configJson,
    },
    nowMs,
  );
  if (claimed.kind === 'conflict') {
    return c.json({ success: false as const, reason: REASON_ROOM_INITIALIZATION_CONFLICT }, 409);
  }
  if (isDeleteSaga(claimed.room)) {
    return c.json({ success: false as const, reason: REASON_ROOM_INITIALIZATION_CONFLICT }, 409);
  }

  try {
    const initialized = await resumeRoomCreation(c.env, claimed.room, nowMs, c.req.raw);
    return c.json(
      {
        room: {
          roomCode: initialized.room.code,
          roomId: initialized.room.id,
          gameType: initialized.room.gameType,
          hostUserId: initialized.room.hostUserId,
          createdAt: initialized.room.createdAt,
        },
      },
      200,
    );
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    if (isCreateSaga(claimed.room)) {
      await recordRoomSagaFailure(c.env, claimed.room, 'create', cause, Date.now());
    }
    log.error('room creation saga interrupted', {
      creationId: input.creationId,
      roomCode: claimed.room.code,
      error: cause.message,
    });
    throw cause;
  }
});

roomRoutes.post('/command', requireAuth, jsonBody(roomCommandSchema), async (c) => {
  const input = c.req.valid('json');
  const resolution = await resolveActiveRoom(c.env, input.roomCode, input.roomId);
  if (resolution.kind === 'missing') {
    return c.json({ success: false as const, reason: REASON_NO_STATE }, 404);
  }
  if (resolution.kind === 'instanceMismatch') {
    return c.json({ success: false as const, reason: REASON_ROOM_INSTANCE_MISMATCH }, 409);
  }
  const { room } = resolution;
  const stub = getGameRoomStub(c.env, room.roomId, c.req.raw);
  const dispatched = await callDO(() =>
    stub.dispatchUserCommand({
      roomCode: room.roomCode,
      roomId: room.roomId,
      creationId: room.creationId,
      commandId: input.commandId,
      actorUserId: c.var.userId,
      controlledSeat: input.controlledSeat,
      command: input.command,
    }),
  );
  if (dispatched.kind === 'unavailable') {
    return c.json({ success: false as const, reason: dispatched.reason }, 404);
  }
  return c.json(dispatched.result, 200);
});

roomRoutes.post('/get', jsonBody(roomCodeBodySchema), async (c) => {
  const { roomCode } = c.req.valid('json');
  const room = await findActiveRoom(c.env, roomCode);
  return c.json(
    {
      room:
        room === null
          ? null
          : {
              roomCode: room.roomCode,
              roomId: room.roomId,
              gameType: room.gameType,
              hostUserId: room.hostUserId,
              createdAt: room.createdAt,
            },
    },
    200,
  );
});

roomRoutes.post('/delete', requireAuth, jsonBody(roomLocatorBodySchema), async (c) => {
  const { roomCode, roomId } = c.req.valid('json');
  const actorUserId = c.var.userId;
  const existing = await findRoomByCode(c.env, roomCode);
  if (existing === null || isCreateSaga(existing)) {
    return c.json({ success: false as const, reason: REASON_NO_STATE }, 404);
  }
  if (existing.id !== roomId) {
    return c.json({ success: false as const, reason: REASON_ROOM_INSTANCE_MISMATCH }, 409);
  }

  let deleting: RoomDirectoryRecord;
  if (existing.status === 'active') {
    const authorization = await callDO(() =>
      getGameRoomStub(c.env, existing.id, c.req.raw).authorizeRoomDeletion({
        roomCode: existing.code,
        roomId: existing.id,
        creationId: existing.creationId,
        actorUserId,
      }),
    );
    if (!authorization.success) {
      const status =
        authorization.reason === REASON_NO_STATE
          ? 404
          : authorization.reason === REASON_ROOM_EFFECTS_PENDING
            ? 409
            : 403;
      return c.json(authorization, status);
    }
    deleting = await beginRoomDeletion(c.env, existing, actorUserId, Date.now());
  } else {
    if (!isDeleteSaga(existing)) {
      throw new Error(`Room ${roomCode} has unsupported directory status ${existing.status}`);
    }
    if (existing.deleteRequestedBy !== actorUserId) {
      return c.json({ success: false as const, reason: REASON_NOT_HOST }, 403);
    }
    deleting = existing;
  }

  try {
    const resumed = await resumeRoomDeletion(c.env, deleting);
    if (resumed.kind === 'blocked') {
      const blocked = new Error(`Room ${roomCode} deletion blocked: ${resumed.reason}`);
      await recordRoomSagaFailure(c.env, deleting, 'delete', blocked, Date.now());
      return c.json({ success: true as const, pending: true as const }, 202);
    }
    return c.json({ success: true as const, pending: false as const }, 200);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    await recordRoomSagaFailure(c.env, deleting, 'delete', cause, Date.now());
    log.error('room deletion saga interrupted', {
      creationId: deleting.creationId,
      roomCode,
      error: cause.message,
    });
    throw cause;
  }
});

roomRoutes.post('/state', jsonBody(roomLocatorBodySchema), async (c) => {
  const { roomCode, roomId } = c.req.valid('json');
  const resolution = await resolveActiveRoom(c.env, roomCode, roomId);
  if (resolution.kind === 'missing') return c.json({ snapshot: null }, 200);
  if (resolution.kind === 'instanceMismatch') {
    return c.json({ success: false as const, reason: REASON_ROOM_INSTANCE_MISMATCH }, 409);
  }
  const { room } = resolution;
  const snapshot = await callDO(() =>
    getGameRoomStub(c.env, room.roomId, c.req.raw).getSnapshot({
      roomCode: room.roomCode,
      roomId: room.roomId,
      creationId: room.creationId,
    }),
  );
  if (snapshot === null) {
    throw new Error(`Active room ${room.roomCode} has no Durable Object snapshot`);
  }
  return c.json({ snapshot }, 200);
});

roomRoutes.post('/revision', jsonBody(roomLocatorBodySchema), async (c) => {
  const { roomCode, roomId } = c.req.valid('json');
  const resolution = await resolveActiveRoom(c.env, roomCode, roomId);
  if (resolution.kind === 'missing') return c.json({ revision: null }, 200);
  if (resolution.kind === 'instanceMismatch') {
    return c.json({ success: false as const, reason: REASON_ROOM_INSTANCE_MISMATCH }, 409);
  }
  const { room } = resolution;
  const revision = await callDO(() =>
    getGameRoomStub(c.env, room.roomId, c.req.raw).getRevision({
      roomCode: room.roomCode,
      roomId: room.roomId,
      creationId: room.creationId,
    }),
  );
  if (revision === null) {
    throw new Error(`Active room ${room.roomCode} has no Durable Object revision`);
  }
  return c.json({ revision }, 200);
});
