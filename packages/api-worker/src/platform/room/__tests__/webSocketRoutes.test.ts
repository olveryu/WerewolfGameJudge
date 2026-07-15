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
});
