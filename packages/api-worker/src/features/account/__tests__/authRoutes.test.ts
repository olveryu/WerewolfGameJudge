/** Account-owned /auth user and profile endpoint integration tests. */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

interface AuthSuccessResponse {
  access_token: string;
}

interface UserProfileResponse {
  data: {
    user: {
      email: string | null;
      is_anonymous: boolean;
      user_metadata: { display_name?: string };
    };
  };
}

async function signUp(email: string, displayName?: string): Promise<string> {
  const response = await SELF.fetch('https://test.local/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'pass123', displayName }),
  });
  const body = await response.json<AuthSuccessResponse>();
  return body.access_token;
}

async function getCurrentUser(token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return SELF.fetch('https://test.local/auth/user', { headers });
}

async function updateProfile(token: string, body: unknown): Promise<Response> {
  return SELF.fetch('https://test.local/auth/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM refresh_tokens;');
  await env.DB.exec('DELETE FROM user_stats;');
  await env.DB.exec('DELETE FROM users;');
});

describe('GET /auth/user', () => {
  it('returns 401 without token', async () => {
    const response = await getCurrentUser();
    expect(response.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const response = await getCurrentUser('garbage-token');
    expect(response.status).toBe(401);
  });

  it('returns the current account with a valid token', async () => {
    const token = await signUp('profile@test.local', 'Profiler');
    const response = await getCurrentUser(token);

    expect(response.status).toBe(200);
    const body = await response.json<UserProfileResponse>();
    expect(body.data.user.email).toBe('profile@test.local');
    expect(body.data.user.is_anonymous).toBe(false);
    expect(body.data.user.user_metadata.display_name).toBe('Profiler');
  });
});

describe('PUT /auth/profile', () => {
  it('updates the display name', async () => {
    const token = await signUp('update@test.local');
    const response = await updateProfile(token, { displayName: 'NewName' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    const currentUser = await getCurrentUser(token);
    const body = await currentUser.json<UserProfileResponse>();
    expect(body.data.user.user_metadata.display_name).toBe('NewName');
  });

  it.each(['avatarFrame', 'seatFlair', 'nameStyle', 'seatAnimation'] as const)(
    'rejects an unknown %s at the request schema boundary',
    async (field) => {
      const token = await signUp(`${field}@test.local`);
      const response = await updateProfile(token, { [field]: 'nonExistent' });

      expect(response.status).toBe(400);
    },
  );

  it('rejects unknown request fields instead of stripping them', async () => {
    const token = await signUp('strict-profile@test.local');
    const response = await updateProfile(token, { displayName: 'Name', unexpected: true });

    expect(response.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const response = await SELF.fetch('https://test.local/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'X' }),
    });

    expect(response.status).toBe(401);
  });

  it('accepts an empty no-op request', async () => {
    const token = await signUp('noop@test.local');
    const response = await updateProfile(token, {});

    expect(response.status).toBe(200);
  });
});
