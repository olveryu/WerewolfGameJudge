/** Public WebSocket admission contract: every rejection is an upgraded socket closed with 4xxx. */

import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

async function connect(query: string): Promise<{ code: number; reason: string }> {
  const response = await SELF.fetch(`https://test.local/ws${query}`, {
    headers: { Upgrade: 'websocket' },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (socket === null) throw new Error('Expected an upgraded socket');
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    socket.addEventListener('close', (event) =>
      resolve({ code: event.code, reason: event.reason }),
    );
  });
  socket.accept();
  return closed;
}

describe('GET /ws', () => {
  it('returns 426 for a plain HTTP request', async () => {
    const response = await SELF.fetch('https://test.local/ws?roomCode=1234&roomId=room-id');
    expect(response.status).toBe(426);
  });

  it('closes 4001 for an invalid room locator', async () => {
    await expect(connect('?roomCode=nope&roomId=room-id&token=x')).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.ROOM_INSTANCE_MISMATCH,
      reason: 'invalid_room_locator',
    });
  });

  it('closes 4002 when the token is missing', async () => {
    await expect(connect('?roomCode=1234&roomId=room-id')).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.AUTH_REJECTED,
      reason: 'token_required',
    });
  });

  it('closes 4002 for an invalid token before resolving the room', async () => {
    await expect(connect('?roomCode=1234&roomId=room-id&token=invalid')).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.AUTH_REJECTED,
      reason: 'unauthorized',
    });
  });

  it('closes 4002 for a revoked token', async () => {
    const signup = await SELF.fetch('https://test.local/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ws-revoked@test.local', password: 'pass123' }),
    });
    const { access_token: token } = await signup.json<{ access_token: string }>();
    const signout = await SELF.fetch('https://test.local/auth/signout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(signout.status).toBe(200);

    await expect(connect(`?roomCode=1234&roomId=room-id&token=${token}`)).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.AUTH_REJECTED,
      reason: 'unauthorized',
    });
  });

  it('closes 4000 for an authenticated user when the room does not exist', async () => {
    const signup = await SELF.fetch('https://test.local/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ws-missing-room@test.local', password: 'pass123' }),
    });
    const { access_token: token } = await signup.json<{ access_token: string }>();

    await expect(connect(`?roomCode=9999&roomId=missing-room&token=${token}`)).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.ROOM_DELETED,
      reason: 'room_not_found',
    });
  });
});
