/** Werewolf AI chat HTTP ownership, authentication, and request-boundary tests. */

import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';

const USER_ID = 'werewolf-ai-chat-user';
const JWT_SECRET = new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production');

async function mintToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: USER_ID, ver: 0, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, token_version, created_at, updated_at)
     VALUES (?1, 'AI Chat User', 0, 0, datetime('now'), datetime('now'))`,
  )
    .bind(USER_ID)
    .run();
});

describe('Werewolf AI chat route', () => {
  it('requires authentication on the game-owned endpoint', async () => {
    const response = await SELF.fetch('https://test.local/api/games/werewolf/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('validates the request before calling an AI provider', async () => {
    const token = await mintToken();
    const response = await SELF.fetch('https://test.local/api/games/werewolf/ai-chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [] }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      reason: 'VALIDATION_ERROR',
    });
  });

  it.each([
    { messages: [{ role: 'user', content: 'test' }], unexpected: true },
    { messages: [{ role: 'user', content: 'test', unexpected: true }] },
  ])('rejects unknown client-controlled fields', async (body) => {
    const token = await mintToken();
    const response = await SELF.fetch('https://test.local/api/games/werewolf/ai-chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
  });

  it('does not retain the removed provider-named route', async () => {
    const response = await SELF.fetch('https://test.local/gemini-proxy', { method: 'POST' });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not found' });
  });
});
