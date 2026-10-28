/** E2E Worker entrypoint; production routes plus E2E-only failure injection. */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import worker from '../index';
import { findActiveRoom } from '../platform/room/roomDirectory';
import { getGameRoomStub } from '../platform/room/roomStub';
import { E2E_CLOSE_SOCKETS_PATH } from './GameRoom';

export { WeChatAuthProxy } from '../features/auth/wechat/WeChatAuthProxy';
export { GameRoom } from './GameRoom';

const e2eApp = new Hono<AppEnv>();

/** Drop every socket of a room with the given close code, as a deploy or edge restart would. */
e2eApp.post('/e2e/rooms/:roomCode/close-sockets', async (c) => {
  const room = await findActiveRoom(c.env, c.req.param('roomCode'));
  if (room === null) return c.json({ error: 'room not found' }, 404);
  const target = new URL(c.req.url);
  target.pathname = E2E_CLOSE_SOCKETS_PATH;
  return getGameRoomStub(c.env, room.roomId).fetch(
    new Request(target.toString(), { method: 'POST' }),
  );
});

e2eApp.all('*', (c) => {
  if (typeof worker.fetch !== 'function') throw new Error('Production worker has no fetch');
  return worker.fetch(c.req.raw, c.env, c.executionCtx);
});

export default { ...worker, fetch: e2eApp.fetch };
