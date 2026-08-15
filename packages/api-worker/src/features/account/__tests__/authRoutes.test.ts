/** Account-owned /auth user and profile endpoint integration tests. */

import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';

interface AuthSuccessResponse {
  access_token: string;
}

interface UserProfileResponse {
  data: {
    user: {
      email: string | null;
      is_anonymous: boolean;
      has_wechat: boolean;
      user_metadata: {
        display_name?: string;
        avatar_url?: string | null;
        custom_avatar_url?: string | null;
        avatar_frame?: string | null;
        seat_flair?: string | null;
        name_style?: string | null;
        equipped_effect?: string | null;
        seat_animation?: string | null;
      };
    };
  };
}

interface AuthErrorResponse {
  success: false;
  reason: string;
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

async function createTokenWithoutSubject(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ver: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(env.JWT_SECRET));
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

  it('returns 401 when a signed token is missing required claims', async () => {
    const response = await getCurrentUser(await createTokenWithoutSubject());

    expect(response.status).toBe(401);
    await expect(response.json<AuthErrorResponse>()).resolves.toEqual({
      success: false,
      reason: 'UNAUTHORIZED',
    });
  });

  it('returns TOKEN_REVOKED after signout', async () => {
    const token = await signUp('revoked@test.local');
    const signout = await SELF.fetch('https://test.local/auth/signout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(signout.status).toBe(200);

    const response = await getCurrentUser(token);
    expect(response.status).toBe(401);
    await expect(response.json<AuthErrorResponse>()).resolves.toEqual({
      success: false,
      reason: 'TOKEN_REVOKED',
    });
  });

  it('returns USER_NOT_FOUND when the token subject no longer exists', async () => {
    const token = await signUp('deleted@test.local');
    await env.DB.prepare('DELETE FROM users WHERE email = ?').bind('deleted@test.local').run();

    const response = await getCurrentUser(token);
    expect(response.status).toBe(404);
    await expect(response.json<AuthErrorResponse>()).resolves.toEqual({
      success: false,
      reason: 'USER_NOT_FOUND',
    });
  });

  it('returns the current account with a valid token', async () => {
    const token = await signUp('profile@test.local', 'Profiler');
    const response = await getCurrentUser(token);

    expect(response.status).toBe(200);
    const body = await response.json<UserProfileResponse>();
    expect(body.data.user.email).toBe('profile@test.local');
    expect(body.data.user.is_anonymous).toBe(false);
    expect(body.data.user.has_wechat).toBe(false);
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

  it('stores unequipped optional profile values as null', async () => {
    const token = await signUp('unequipped@test.local');
    const response = await updateProfile(token, {
      avatarUrl: '',
      customAvatarUrl: '',
      avatarFrame: '',
      seatFlair: '',
      nameStyle: '',
      equippedEffect: '',
      seatAnimation: '',
    });

    expect(response.status).toBe(200);
    const currentUser = await getCurrentUser(token);
    const body = await currentUser.json<UserProfileResponse>();
    expect(body.data.user.user_metadata).toMatchObject({
      avatar_url: null,
      custom_avatar_url: null,
      avatar_frame: null,
      seat_flair: null,
      name_style: null,
      equipped_effect: null,
      seat_animation: null,
    });

    const userRow = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
      .bind('unequipped@test.local')
      .first<{ id: string }>();
    if (userRow === null) throw new Error('[FAIL-FAST] Missing unequipped profile test user');
    const publicProfileResponse = await SELF.fetch(
      `https://test.local/api/user/${userRow.id}/profile`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const publicProfile = await publicProfileResponse.json<Record<string, unknown>>();
    expect(publicProfile).not.toHaveProperty('avatarUrl');
    expect(publicProfile).not.toHaveProperty('avatarFrame');
    expect(publicProfile).not.toHaveProperty('seatFlair');
    expect(publicProfile).not.toHaveProperty('nameStyle');
    expect(publicProfile).not.toHaveProperty('revealEffect');
    expect(publicProfile).not.toHaveProperty('seatAnimation');
  });

  it('preserves the random reveal-effect selection in the public profile', async () => {
    const email = 'random-effect@test.local';
    const token = await signUp(email);
    const response = await updateProfile(token, { equippedEffect: 'random' });

    expect(response.status).toBe(200);
    const userRow = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (userRow === null) throw new Error('[FAIL-FAST] Missing random effect profile test user');

    const publicProfileResponse = await SELF.fetch(
      `https://test.local/api/user/${userRow.id}/profile`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(publicProfileResponse.status).toBe(200);
    await expect(publicProfileResponse.json()).resolves.toMatchObject({ revealEffect: 'random' });
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
