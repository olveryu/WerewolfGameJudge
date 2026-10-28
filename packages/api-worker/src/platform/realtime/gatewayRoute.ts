/**
 * `/ws` admission: authenticate, resolve the active room, hand the socket to the room Durable
 * Object. Every rejection completes the WebSocket upgrade and then closes with a typed 4xxx code so
 * browsers can distinguish terminal failures from network drops.
 */

import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import {
  REALTIME_CLOSE_CODE,
  type RealtimeCloseCode,
} from '@game-judge/game-engine/platform/realtime/closeCodes';
import type { Handler } from 'hono';

import type { AppEnv, Env } from '../../env';
import { callDurableObject } from '../http/callDurableObject';
import { resolveActiveRoom } from '../room/roomDirectory';
import { getGameRoomStub } from '../room/roomStub';

export type RoomSocketAuthenticator = (token: string, bindings: Env) => Promise<string | null>;

/** Upgrade and immediately close so the client observes `code` instead of an opaque 1006. */
export function rejectUpgrade(code: RealtimeCloseCode, reason: string): Response {
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(code, reason);
  return new Response(null, { status: 101, webSocket: pair[0] });
}

export function createRoomSocketHandler(authenticate: RoomSocketAuthenticator): Handler<AppEnv> {
  return async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
      return c.json({ error: 'websocket upgrade required' }, 426);
    }
    const roomCode = c.req.query('roomCode');
    const roomId = c.req.query('roomId');
    const token = c.req.query('token');
    if (
      roomCode === undefined ||
      !isRoomCode(roomCode) ||
      roomId === undefined ||
      roomId.length === 0
    ) {
      return rejectUpgrade(REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH, 'invalid_room_locator');
    }
    if (token === undefined || token.length === 0) {
      return rejectUpgrade(REALTIME_CLOSE_CODE.AUTH_REJECTED, 'token_required');
    }
    const userId = await authenticate(token, c.env);
    if (userId === null) {
      return rejectUpgrade(REALTIME_CLOSE_CODE.AUTH_REJECTED, 'unauthorized');
    }

    const resolution = await resolveActiveRoom(c.env, roomCode, roomId);
    if (resolution.kind === 'missing') {
      return rejectUpgrade(REALTIME_CLOSE_CODE.ROOM_DELETED, 'room_not_found');
    }
    if (resolution.kind === 'instanceMismatch') {
      return rejectUpgrade(REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH, 'room_instance_mismatch');
    }

    const { room } = resolution;
    const stub = getGameRoomStub(c.env, room.roomId, c.req.raw);
    // The token never reaches the Durable Object or its logs; only the resolved identity does.
    const doUrl = new URL(c.req.url);
    doUrl.pathname = '/websocket';
    doUrl.search = '';
    doUrl.searchParams.set('userId', userId);
    doUrl.searchParams.set('roomCode', room.roomCode);
    doUrl.searchParams.set('roomId', room.roomId);
    doUrl.searchParams.set('creationId', room.creationId);
    return await callDurableObject(() => stub.fetch(new Request(doUrl.toString(), c.req.raw)));
  };
}
