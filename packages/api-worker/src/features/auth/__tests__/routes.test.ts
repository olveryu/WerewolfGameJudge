/**
 * Auth Handler — integration tests
 *
 * Tests all /auth/* endpoints against the real Hono app running in
 * the @cloudflare/vitest-pool-workers runtime with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

// ── Response type contracts ─────────────────────────────────────────────────

interface AuthSuccessResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string | null;
    is_anonymous: boolean;
    has_wechat: boolean;
    user_metadata: { display_name?: string };
  };
}

interface AuthErrorResponse {
  success: false;
  reason: string;
}

interface ResetPasswordSuccessResponse {
  success: boolean;
  access_token: string;
  user: { email: string };
}

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function postJson(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return SELF.fetch(`https://test.local${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function putJson(path: string, body: unknown, token: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/** Clean all test data between tests */
beforeEach(async () => {
  await env.DB.exec(`DELETE FROM draw_history;`);
  await env.DB.exec(`DELETE FROM refresh_tokens;`);
  await env.DB.exec(`DELETE FROM password_reset_tokens;`);
  await env.DB.exec(`DELETE FROM login_attempts;`);
  await env.DB.exec(`DELETE FROM user_stats;`);
  await env.DB.exec(`DELETE FROM users;`);
});

// ── POST /auth/anonymous ────────────────────────────────────────────────────

describe('POST /auth/anonymous', () => {
  it('creates anonymous user and returns JWT', async () => {
    const res = await postJson('/auth/anonymous', {});
    expect(res.status).toBe(200);

    const body = await res.json<AuthSuccessResponse>();
    expect(body.access_token).toBeTruthy();
    expect(body.user.id).toBeTruthy();
    expect(body.user.is_anonymous).toBe(true);
    expect(body.user.has_wechat).toBe(false);
    expect(body.user.email).toBeNull();
  });

  it('creates distinct users on consecutive calls', async () => {
    const res1 = await postJson('/auth/anonymous', {});
    const res2 = await postJson('/auth/anonymous', {});
    const body1 = await res1.json<AuthSuccessResponse>();
    const body2 = await res2.json<AuthSuccessResponse>();
    expect(body1.user.id).not.toBe(body2.user.id);
  });
});

// ── POST /auth/signup ───────────────────────────────────────────────────────

describe('POST /auth/signup', () => {
  it('registers new user with email and password', async () => {
    const res = await postJson('/auth/signup', {
      email: 'new@test.local',
      password: 'pass123',
    });
    expect(res.status).toBe(200);

    const body = await res.json<AuthSuccessResponse>();
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe('new@test.local');
    expect(body.user.is_anonymous).toBe(false);
    expect(body.user.has_wechat).toBe(false);
  });

  it('grants welcome bonus on signup', async () => {
    const res = await postJson('/auth/signup', {
      email: 'bonus@test.local',
      password: 'pass123',
    });
    const body = await res.json<AuthSuccessResponse>();

    // Check user_stats for welcome bonus (5 normal + 1 golden)
    const stats = await env.DB.prepare(
      `SELECT normal_draws, golden_draws FROM user_stats WHERE user_id = ?`,
    )
      .bind(body.user.id)
      .first<{ normal_draws: number; golden_draws: number }>();

    expect(stats!.normal_draws).toBe(5);
    expect(stats!.golden_draws).toBe(1);
  });

  it('rejects duplicate email', async () => {
    await postJson('/auth/signup', { email: 'dup@test.local', password: 'pass123' });
    const res = await postJson('/auth/signup', { email: 'dup@test.local', password: 'pass456' });
    expect(res.status).toBe(409);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('uses custom displayName when provided', async () => {
    const res = await postJson('/auth/signup', {
      email: 'named@test.local',
      password: 'pass123',
      displayName: 'MyName',
    });
    const body = await res.json<AuthSuccessResponse>();
    expect(body.user.user_metadata.display_name).toBe('MyName');
  });

  it('normalizes email to lowercase', async () => {
    const res = await postJson('/auth/signup', {
      email: 'UPPER@Test.LOCAL',
      password: 'pass123',
    });
    const body = await res.json<AuthSuccessResponse>();
    expect(body.user.email).toBe('upper@test.local');
  });

  it('upgrades anonymous user in-place', async () => {
    // Create anonymous user
    const anonRes = await postJson('/auth/anonymous', {});
    const anonBody = await anonRes.json<AuthSuccessResponse>();

    // Signup with same token → upgrade
    const res = await postJson(
      '/auth/signup',
      { email: 'upgraded@test.local', password: 'pass123' },
      anonBody.access_token,
    );
    expect(res.status).toBe(200);

    const body = await res.json<AuthSuccessResponse>();
    // UID should be preserved
    expect(body.user.id).toBe(anonBody.user.id);
    expect(body.user.email).toBe('upgraded@test.local');
    expect(body.user.is_anonymous).toBe(false);
    expect(body.user.has_wechat).toBe(false);
  });

  it('does not upgrade an anonymous account through a revoked token', async () => {
    const anonRes = await postJson('/auth/anonymous', {});
    const anonBody = await anonRes.json<AuthSuccessResponse>();
    const signout = await postJson('/auth/signout', {}, anonBody.access_token);
    expect(signout.status).toBe(200);

    const res = await postJson(
      '/auth/signup',
      { email: 'after-signout@test.local', password: 'pass123' },
      anonBody.access_token,
    );
    expect(res.status).toBe(200);

    const body = await res.json<AuthSuccessResponse>();
    expect(body.user.id).not.toBe(anonBody.user.id);
  });

  it('rejects validation error for missing password', async () => {
    const res = await postJson('/auth/signup', { email: 'bad@test.local' });
    expect(res.status).toBe(400);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown request fields instead of stripping them', async () => {
    const res = await postJson('/auth/signup', {
      email: 'strict@test.local',
      password: 'pass123',
      unexpected: true,
    });

    expect(res.status).toBe(400);
  });
});

// ── POST /auth/signin ───────────────────────────────────────────────────────

describe('POST /auth/signin', () => {
  beforeEach(async () => {
    // Create a registered user for signin tests
    await postJson('/auth/signup', { email: 'login@test.local', password: 'correct' });
  });

  it('authenticates with valid credentials', async () => {
    const res = await postJson('/auth/signin', {
      email: 'login@test.local',
      password: 'correct',
    });
    expect(res.status).toBe(200);

    const body = await res.json<AuthSuccessResponse>();
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe('login@test.local');
    expect(body.user.is_anonymous).toBe(false);
    expect(body.user.has_wechat).toBe(false);
  });

  it('rejects wrong password', async () => {
    const res = await postJson('/auth/signin', {
      email: 'login@test.local',
      password: 'wrong',
    });
    expect(res.status).toBe(401);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('INVALID_CREDENTIALS');
  });

  it('rejects non-existent email', async () => {
    const res = await postJson('/auth/signin', {
      email: 'nobody@test.local',
      password: 'whatever',
    });
    expect(res.status).toBe(401);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('INVALID_CREDENTIALS');
  });

  it('rate limits after 10 failed attempts', async () => {
    // Burn through 10 failed attempts
    for (let i = 0; i < 10; i++) {
      await postJson('/auth/signin', { email: 'login@test.local', password: 'wrong' });
    }

    // 11th attempt should be rate limited
    const res = await postJson('/auth/signin', {
      email: 'login@test.local',
      password: 'correct', // even correct password should be blocked
    });
    expect(res.status).toBe(429);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('TOO_MANY_ATTEMPTS');
  });
});

// ── PUT /auth/password ──────────────────────────────────────────────────────

describe('PUT /auth/password', () => {
  let token: string;

  beforeEach(async () => {
    const res = await postJson('/auth/signup', {
      email: 'pw@test.local',
      password: 'oldpass',
    });
    token = (await res.json<AuthSuccessResponse>()).access_token;
  });

  it('changes password with correct old password', async () => {
    const res = await putJson(
      '/auth/password',
      { oldPassword: 'oldpass', newPassword: 'newpass' },
      token,
    );
    expect(res.status).toBe(200);

    // Verify new password works
    const signinRes = await postJson('/auth/signin', {
      email: 'pw@test.local',
      password: 'newpass',
    });
    expect(signinRes.status).toBe(200);
  });

  it('rejects wrong old password', async () => {
    const res = await putJson(
      '/auth/password',
      { oldPassword: 'wrong', newPassword: 'newpass' },
      token,
    );
    expect(res.status).toBe(401);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('INVALID_OLD_PASSWORD');
  });

  it('rejects anonymous user password change', async () => {
    const anonRes = await postJson('/auth/anonymous', {});
    const anonBody = await anonRes.json<AuthSuccessResponse>();

    const res = await putJson(
      '/auth/password',
      { oldPassword: 'x', newPassword: 'newpass' },
      anonBody.access_token,
    );
    expect(res.status).toBe(400);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('NO_PASSWORD');
  });
});

// ── POST /auth/signout ──────────────────────────────────────────────────────

describe('POST /auth/signout', () => {
  it('returns success with valid token', async () => {
    const signupRes = await postJson('/auth/signup', {
      email: 'out@test.local',
      password: 'pass123',
    });
    const { access_token } = await signupRes.json<AuthSuccessResponse>();

    const res = await postJson('/auth/signout', {}, access_token);
    expect(res.status).toBe(200);

    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await postJson('/auth/signout', {});
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/refresh ──────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('replays the same successor when the first rotation response is lost', async () => {
    const anonymousResponse = await postJson('/auth/anonymous', {});
    const initialTokens = await anonymousResponse.json<AuthSuccessResponse>();

    const firstRotationResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    expect(firstRotationResponse.status).toBe(200);
    const firstRotation = await firstRotationResponse.json<TokenPairResponse>();

    const replayResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    expect(replayResponse.status).toBe(200);
    const replay = await replayResponse.json<TokenPairResponse>();

    expect(replay.refresh_token).toBe(firstRotation.refresh_token);
    expect(replay.access_token).toBeTruthy();
  });

  it('returns one successor to concurrent rotation requests', async () => {
    const anonymousResponse = await postJson('/auth/anonymous', {});
    const initialTokens = await anonymousResponse.json<AuthSuccessResponse>();

    const [firstResponse, secondResponse] = await Promise.all([
      postJson('/auth/refresh', { refresh_token: initialTokens.refresh_token }),
      postJson('/auth/refresh', { refresh_token: initialTokens.refresh_token }),
    ]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const [firstRotation, secondRotation] = await Promise.all([
      firstResponse.json<TokenPairResponse>(),
      secondResponse.json<TokenPairResponse>(),
    ]);
    expect(secondRotation.refresh_token).toBe(firstRotation.refresh_token);
  });

  it('revokes only the reused family when an older ancestor is submitted', async () => {
    const signupResponse = await postJson('/auth/signup', {
      email: 'family-isolation@test.local',
      password: 'pass123',
    });
    const initialTokens = await signupResponse.json<AuthSuccessResponse>();
    const secondFamilyResponse = await postJson('/auth/signin', {
      email: 'family-isolation@test.local',
      password: 'pass123',
    });
    const secondFamily = await secondFamilyResponse.json<AuthSuccessResponse>();
    const firstRotationResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    const firstRotation = await firstRotationResponse.json<TokenPairResponse>();
    const secondRotationResponse = await postJson('/auth/refresh', {
      refresh_token: firstRotation.refresh_token,
    });
    const secondRotation = await secondRotationResponse.json<TokenPairResponse>();

    const ancestorReuseResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    expect(ancestorReuseResponse.status).toBe(401);

    const currentTokenResponse = await postJson('/auth/refresh', {
      refresh_token: secondRotation.refresh_token,
    });
    expect(currentTokenResponse.status).toBe(401);

    const independentFamilyResponse = await postJson('/auth/refresh', {
      refresh_token: secondFamily.refresh_token,
    });
    expect(independentFamilyResponse.status).toBe(200);
  });

  it('revokes the family when its direct predecessor is reused after the overlap window', async () => {
    const anonymousResponse = await postJson('/auth/anonymous', {});
    const initialTokens = await anonymousResponse.json<AuthSuccessResponse>();
    const rotationResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    const rotation = await rotationResponse.json<TokenPairResponse>();
    const expiredReplayTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const historyUpdate = await env.DB.prepare(`UPDATE refresh_token_rotations SET rotated_at = ?`)
      .bind(expiredReplayTimestamp)
      .run();
    expect(historyUpdate.meta.changes).toBe(1);

    const lateReplayResponse = await postJson('/auth/refresh', {
      refresh_token: initialTokens.refresh_token,
    });
    expect(lateReplayResponse.status).toBe(401);

    const currentTokenResponse = await postJson('/auth/refresh', {
      refresh_token: rotation.refresh_token,
    });
    expect(currentTokenResponse.status).toBe(401);
  });
});

// ── POST /auth/forgot-password + POST /auth/reset-password ──────────────────

describe('password reset flow', () => {
  it('forgot-password returns success for non-existent email (no enumeration)', async () => {
    const res = await postJson('/auth/forgot-password', {
      email: 'ghost@test.local',
    });
    expect(res.status).toBe(200);

    const body = await res.json<{ success: boolean }>();
    expect(body.success).toBe(true);
  });

  it('reset-password rejects invalid code', async () => {
    // Signup first so email exists
    await postJson('/auth/signup', {
      email: 'reset@test.local',
      password: 'pass123',
    });

    const res = await postJson('/auth/reset-password', {
      email: 'reset@test.local',
      code: '000000',
      newPassword: 'newpass123',
    });
    expect(res.status).toBe(400);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('INVALID_OR_EXPIRED_CODE');
  });

  it('reset-password with valid token changes password and returns JWT', async () => {
    // Signup
    await postJson('/auth/signup', {
      email: 'resetok@test.local',
      password: 'oldpass',
    });

    // Look up the user to get userId
    const userRow = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
      .bind('resetok@test.local')
      .first<{ id: string }>();

    // Manually insert a valid reset token (bypassing email send)
    const code = '123456';
    const email = 'resetok@test.local';
    // Compute SHA-256(code + email) to match what the handler verifies
    const data = new TextEncoder().encode(code + email);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, is_used, verify_attempts, created_at)
       VALUES ('tok-1', ?, ?, ?, 0, 0, datetime('now'))`,
    )
      .bind(userRow!.id, tokenHash, expiresAt)
      .run();

    // Submit reset
    const res = await postJson('/auth/reset-password', {
      email: 'resetok@test.local',
      code: '123456',
      newPassword: 'brandnew',
    });
    expect(res.status).toBe(200);

    const body = await res.json<ResetPasswordSuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe('resetok@test.local');

    // Verify new password works
    const signinRes = await postJson('/auth/signin', {
      email: 'resetok@test.local',
      password: 'brandnew',
    });
    expect(signinRes.status).toBe(200);
  });

  it('reset-password invalidates token after 5 failed attempts', async () => {
    await postJson('/auth/signup', {
      email: 'brute@test.local',
      password: 'pass123',
    });

    const userRow = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
      .bind('brute@test.local')
      .first<{ id: string }>();

    // Insert token with correct hash for code "999999"
    const code = '999999';
    const email = 'brute@test.local';
    const data = new TextEncoder().encode(code + email);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, is_used, verify_attempts, created_at)
       VALUES ('tok-brute', ?, ?, ?, 0, 0, datetime('now'))`,
    )
      .bind(userRow!.id, tokenHash, expiresAt)
      .run();

    // 5 wrong guesses
    for (let i = 0; i < 5; i++) {
      await postJson('/auth/reset-password', {
        email: 'brute@test.local',
        code: '000000',
        newPassword: 'whatever',
      });
    }

    // Now even the correct code should fail (token exhausted)
    const res = await postJson('/auth/reset-password', {
      email: 'brute@test.local',
      code: '999999',
      newPassword: 'whatever',
    });
    expect(res.status).toBe(400);

    const body = await res.json<AuthErrorResponse>();
    expect(body.reason).toBe('INVALID_OR_EXPIRED_CODE');
  });
});
