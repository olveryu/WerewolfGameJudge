/** Public WebSocket admission contract tests. */

import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('GET /ws', () => {
  it('rejects a missing room code before authentication', async () => {
    const response = await SELF.fetch('https://test.local/ws');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'valid roomCode required' });
  });

  it('requires a token for a concrete room identity', async () => {
    const response = await SELF.fetch('https://test.local/ws?roomCode=1234&roomId=room-id');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'token required' });
  });

  it('rejects an invalid token before resolving the room', async () => {
    const response = await SELF.fetch(
      'https://test.local/ws?roomCode=1234&roomId=room-id&token=invalid',
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('rejects a revoked token before resolving the room', async () => {
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

    const response = await SELF.fetch(
      `https://test.local/ws?roomCode=1234&roomId=room-id&token=${token}`,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });
});
