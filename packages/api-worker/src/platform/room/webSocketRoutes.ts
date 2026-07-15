/** WebSocket admission handler owned by the shared room platform. */

import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { Handler } from 'hono';

import type { AppEnv, Env } from '../../env';
import { callDurableObject } from '../http/callDurableObject';
import { resolveActiveRoom } from './roomDirectory';
import { getGameRoomStub } from './roomStub';

export type RoomWebSocketAuthenticator = (token: string, bindings: Env) => Promise<string | null>;

/** Build the `/ws` handler while keeping authentication composition outside the room platform. */
export function createRoomWebSocketHandler(
  authenticate: RoomWebSocketAuthenticator,
): Handler<AppEnv> {
  return async (c) => {
    const roomCode = c.req.query('roomCode');
    const roomId = c.req.query('roomId');
    const token = c.req.query('token');
    if (roomCode === undefined || !isRoomCode(roomCode)) {
      return c.json({ error: 'valid roomCode required' }, 400);
    }
    if (roomId === undefined || roomId.length === 0) {
      return c.json({ error: 'roomId required' }, 400);
    }
    if (token === undefined || token.length === 0) {
      return c.json({ error: 'token required' }, 401);
    }

    const userId = await authenticate(token, c.env);
    if (userId === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const resolution = await resolveActiveRoom(c.env, roomCode, roomId);
    if (resolution.kind === 'missing') {
      return c.json({ error: 'room not found' }, 404);
    }
    if (resolution.kind === 'instanceMismatch') {
      return c.json({ error: 'room instance mismatch' }, 409);
    }

    const { room } = resolution;
    const stub = getGameRoomStub(c.env, room.roomId, c.req.raw);
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
