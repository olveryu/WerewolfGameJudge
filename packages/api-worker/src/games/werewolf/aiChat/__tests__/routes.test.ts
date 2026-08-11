/** Werewolf AI chat HTTP ownership, Gemini behavior, and request-boundary tests. */

import { env, exports } from 'cloudflare:workers';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = 'werewolf-ai-chat-user';
const JWT_SECRET = new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production');
const GEMINI_COMPLETIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

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

afterEach(() => {
  vi.restoreAllMocks();
});

async function requestAiChat(body: object): Promise<Response> {
  const token = await mintToken();
  return exports.default.fetch('https://test.local/api/games/werewolf/ai-chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('Werewolf AI chat route', () => {
  it('requires authentication on the game-owned endpoint', async () => {
    const response = await exports.default.fetch('https://test.local/api/games/werewolf/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('validates the request before calling an AI provider', async () => {
    const response = await requestAiChat({ messages: [] });

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
    const response = await requestAiChat(body);

    expect(response.status).toBe(400);
  });

  it('returns the Gemini response without a fallback provider', async () => {
    const geminiResponse = {
      choices: [{ message: { role: 'assistant', content: '测试回复' } }],
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.resolve(Response.json(geminiResponse)));

    const response = await requestAiChat({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(geminiResponse);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      GEMINI_COMPLETIONS_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns quota exhausted when Gemini responds with 429', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve(new Response('quota exhausted', { status: 429 })),
      );

    const response = await requestAiChat({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'QUOTA_EXHAUSTED',
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('retries Gemini once after a 503 response', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.resolve(new Response('overloaded', { status: 503 })))
      .mockImplementationOnce(() => Promise.resolve(Response.json({ choices: [] })));

    const response = await requestAiChat({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ choices: [] });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable after Gemini responds with 503 twice', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('overloaded', { status: 503 })));

    const response = await requestAiChat({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'AI_UNAVAILABLE',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable when the Gemini request fails', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.reject(new Error('network unavailable')));

    const response = await requestAiChat({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'AI_UNAVAILABLE',
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('does not retain the removed provider-named route', async () => {
    const response = await exports.default.fetch('https://test.local/gemini-proxy', {
      method: 'POST',
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not found' });
  });
});
