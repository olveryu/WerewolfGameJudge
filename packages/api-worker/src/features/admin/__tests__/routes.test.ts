/**
 * Admin identity-based auth — integration tests
 *
 * Verifies the admin portal no longer uses X-Admin-Token / ADMIN_PASSWORD.
 * Auth is the app JWT system: requireAuth verifies the access token, then
 * requireAdmin checks users.is_admin (or the ADMIN_USER_IDS super-admin
 * allowlist, set to "test-super-admin" in wrangler.test.toml).
 *
 * Also covers:
 * - GET /admin/rooms game-start visibility fields (gamesStarted / lastStartedAt)
 * - GET /admin/whoami (super-admin flag for the portal UI)
 * - POST /admin/users/:id/admin (super-admin-only grant/revoke)
 *
 * Runs in the Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../auth/tokenAuth';

const SUPER_ADMIN_ID = 'test-super-admin';
const ADMIN_USER_ID = 'admin-test-user';
const REGULAR_USER_ID = 'regular-test-user';
const ANON_USER_ID = 'anon-test-user';
const HOST_USER_ID = 'admin-rooms-host-user';

interface AdminRoom {
  id: string;
  code: string;
  hostUserId: string;
  hostName: string | null;
  hostCountry: string | null;
  gamesStarted: number;
  lastStartedAt: string | null;
  participantCount: number;
  createdAt: string;
}

interface AdminRoomsResponse {
  rooms: AdminRoom[];
  total: number;
}

interface AdminUserEntry {
  id: string;
  isAdmin: boolean;
}

interface AdminUsersResponse {
  users: AdminUserEntry[];
  total: number;
}

/** Insert a user row with explicit admin flags. */
async function insertUser(id: string, isAnonymous: boolean, isAdmin: boolean): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users
       (id, display_name, last_country, is_anonymous, is_admin, token_version, created_at, updated_at)
     VALUES (?, ?, 'JP', ?, ?, 0, datetime('now'), datetime('now'))`,
  )
    .bind(id, `User-${id}`, isAnonymous ? 1 : 0, isAdmin ? 1 : 0)
    .run();
}

async function authHeaders(userId: string): Promise<Record<string, string>> {
  const pair = await issueTokenPair(userId, env, 0);
  return { Authorization: `Bearer ${pair.access_token}` };
}

async function getAdmin(path: string, userId: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, { headers: await authHeaders(userId) });
}

beforeEach(async () => {
  await env.DB.exec(
    'DELETE FROM rooms; DELETE FROM refresh_tokens; DELETE FROM user_stats; DELETE FROM users;',
  );
  await insertUser(HOST_USER_ID, false, false);
  await insertUser(SUPER_ADMIN_ID, false, false); // super via ADMIN_USER_IDS env, is_admin=0
  await insertUser(ADMIN_USER_ID, false, true); // regular admin via DB flag
  await insertUser(REGULAR_USER_ID, false, false);
  await insertUser(ANON_USER_ID, true, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Insert a room row with explicit game-start fields. */
async function insertRoom(
  id: string,
  code: string,
  gamesStarted: number,
  lastStartedAt: string | null,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started, last_started_at
    ) VALUES (?, ?, 'werewolf', ?, ?, '{}', 'active', datetime('now'), datetime('now'), ?, ?)`,
  )
    .bind(id, code, HOST_USER_ID, `creation-${id}`, gamesStarted, lastStartedAt)
    .run();
}

describe('admin auth (JWT + is_admin)', () => {
  it('rejects requests without a token (401)', async () => {
    const res = await SELF.fetch('https://test.local/admin/rooms');
    expect(res.status).toBe(401);
  });

  it('rejects the legacy X-Admin-Token header (401)', async () => {
    const res = await SELF.fetch('https://test.local/admin/rooms', {
      headers: { 'X-Admin-Token': 'test-admin-password-12345' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a regular authenticated user (403)', async () => {
    expect((await getAdmin('/admin/rooms', REGULAR_USER_ID)).status).toBe(403);
  });

  it('rejects an anonymous user (403)', async () => {
    expect((await getAdmin('/admin/rooms', ANON_USER_ID)).status).toBe(403);
  });

  it('allows a user with is_admin=1 (200)', async () => {
    expect((await getAdmin('/admin/rooms', ADMIN_USER_ID)).status).toBe(200);
  });

  it('allows a super admin from ADMIN_USER_IDS even with is_admin=0 (200)', async () => {
    expect((await getAdmin('/admin/rooms', SUPER_ADMIN_ID)).status).toBe(200);
  });
});

describe('GET /admin/whoami', () => {
  it('reports the super-admin flag', async () => {
    const superRes = await getAdmin('/admin/whoami', SUPER_ADMIN_ID);
    expect(superRes.status).toBe(200);
    await expect(superRes.json()).resolves.toMatchObject({
      userId: SUPER_ADMIN_ID,
      isSuperAdmin: true,
    });

    const adminRes = await getAdmin('/admin/whoami', ADMIN_USER_ID);
    expect(adminRes.status).toBe(200);
    await expect(adminRes.json()).resolves.toMatchObject({
      userId: ADMIN_USER_ID,
      isSuperAdmin: false,
    });
  });

  it('rejects non-admins (403)', async () => {
    expect((await getAdmin('/admin/whoami', REGULAR_USER_ID)).status).toBe(403);
  });
});

describe('GET /admin/users is_admin field', () => {
  it('returns isAdmin for each user', async () => {
    const res = await getAdmin('/admin/users', SUPER_ADMIN_ID);
    expect(res.status).toBe(200);
    const body = await res.json<AdminUsersResponse>();
    const byId = new Map(body.users.map((u) => [u.id, u.isAdmin]));
    expect(byId.get(SUPER_ADMIN_ID)).toBe(true); // super admin counts as admin
    expect(byId.get(ADMIN_USER_ID)).toBe(true);
    expect(byId.get(REGULAR_USER_ID)).toBe(false);
  });
});

describe('POST /admin/users/:id/admin', () => {
  async function setAdmin(targetId: string, isAdmin: boolean, callerId: string): Promise<Response> {
    return SELF.fetch(`https://test.local/admin/users/${targetId}/admin`, {
      method: 'POST',
      headers: { ...(await authHeaders(callerId)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin }),
    });
  }

  async function dbIsAdmin(userId: string): Promise<number | null> {
    const row = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?')
      .bind(userId)
      .first<{ is_admin: number }>();
    return row?.is_admin ?? null;
  }

  it('grants admin to a regular user (super admin)', async () => {
    const res = await setAdmin(REGULAR_USER_ID, true, SUPER_ADMIN_ID);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      id: REGULAR_USER_ID,
      isAdmin: true,
    });
    expect(await dbIsAdmin(REGULAR_USER_ID)).toBe(1);
  });

  it('revokes admin from a regular admin (super admin)', async () => {
    const res = await setAdmin(ADMIN_USER_ID, false, SUPER_ADMIN_ID);
    expect(res.status).toBe(200);
    expect(await dbIsAdmin(ADMIN_USER_ID)).toBe(0);
  });

  it('newly granted admin can access the portal', async () => {
    await setAdmin(REGULAR_USER_ID, true, SUPER_ADMIN_ID);
    expect(
      (await getAdmin('/admin/stats?from=2026-01-01&to=2026-12-31', REGULAR_USER_ID)).status,
    ).toBe(200);
  });

  it('rejects a regular admin caller (403 SUPER_ADMIN_FORBIDDEN)', async () => {
    const res = await setAdmin(REGULAR_USER_ID, true, ADMIN_USER_ID);
    expect(res.status).toBe(403);
    expect(await dbIsAdmin(REGULAR_USER_ID)).toBe(0);
  });

  it('rejects a non-admin caller (403)', async () => {
    const res = await setAdmin(REGULAR_USER_ID, true, REGULAR_USER_ID);
    expect(res.status).toBe(403);
  });

  it('refuses to demote a super admin (403)', async () => {
    const res = await setAdmin(SUPER_ADMIN_ID, false, SUPER_ADMIN_ID);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown user', async () => {
    const res = await setAdmin('no-such-user', true, SUPER_ADMIN_ID);
    expect(res.status).toBe(404);
  });

  it('refuses to grant an anonymous user (422)', async () => {
    const res = await setAdmin(ANON_USER_ID, true, SUPER_ADMIN_ID);
    expect(res.status).toBe(422);
    expect(await dbIsAdmin(ANON_USER_ID)).toBe(0);
  });

  it('rejects an invalid body (400)', async () => {
    const res = await SELF.fetch(`https://test.local/admin/users/${REGULAR_USER_ID}/admin`, {
      method: 'POST',
      headers: { ...(await authHeaders(SUPER_ADMIN_ID)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: 'yes' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/rooms game-start visibility', () => {
  it('returns gamesStarted + lastStartedAt for a played room', async () => {
    const startedAt = '2026-06-30T08:15:00.000Z';
    await insertRoom('room-played', '1111', 3, startedAt);

    const res = await getAdmin('/admin/rooms', SUPER_ADMIN_ID);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === '1111');
    if (!room) throw new Error('room 1111 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(3);
    expect(room.lastStartedAt).toBe(startedAt);
    expect(room.hostName).toBe(`User-${HOST_USER_ID}`);
    expect(room.hostCountry).toBe('JP');
  });

  it('returns zero / null for a never-started room', async () => {
    await insertRoom('room-fresh', '2222', 0, null);

    const res = await getAdmin('/admin/rooms', SUPER_ADMIN_ID);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === '2222');
    if (!room) throw new Error('room 2222 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(0);
    expect(room.lastStartedAt).toBeNull();
  });
});

describe('GET /admin/request-traffic', () => {
  it('combines platform, HTTP, and WebSocket analytics behind admin authentication', async () => {
    const externalFetch = vi.fn<typeof fetch>(async (input, init) => {
      const request = new Request(input, init);
      if (request.url === 'https://api.cloudflare.com/client/v4/graphql') {
        return Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  workersInvocationsAdaptive: [{ sum: { requests: 9, errors: 1, subrequests: 3 } }],
                },
              ],
            },
          },
          errors: null,
        });
      }

      const sqlQuery = await request.text();
      if (sqlQuery.includes("blob1 = 'HTTP_REQUEST'")) {
        return Response.json({
          data: [
            {
              bucket: 1788134400,
              method: 'POST',
              route: '/room/command',
              status: 200,
              requestCount: 7,
              durationTotalMs: 70,
            },
          ],
        });
      }
      if (sqlQuery.includes("blob1 = 'WEBSOCKET_MESSAGE'")) {
        return Response.json({
          data: [
            {
              messageType: 'STATE_SYNC_REQUEST',
              messageCount: 2,
              deliveryCount: 2,
              transferredBytes: 160,
            },
          ],
        });
      }
      throw new Error(`Unexpected external analytics request: ${request.url}`);
    });
    vi.stubGlobal('fetch', externalFetch);

    const response = await SELF.fetch(
      'https://test.local/admin/request-traffic?from=2026-08-31T00%3A00%3A00Z&to=2026-08-31T01%3A00%3A00Z',
      { headers: await authHeaders(SUPER_ADMIN_ID) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      platform: { requests: 9, errors: 1, subrequests: 3 },
      requestCountDelta: 2,
      http: { totalRequests: 7 },
      realtime: { stateSyncRequests: 2 },
    });
    expect(externalFetch).toHaveBeenCalledTimes(3);
  });

  it('rejects ranges over 30 days before querying analytics providers', async () => {
    const externalFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', externalFetch);

    const response = await SELF.fetch(
      'https://test.local/admin/request-traffic?from=2026-07-01T00%3A00%3A00Z&to=2026-08-31T01%3A00%3A00Z',
      { headers: await authHeaders(SUPER_ADMIN_ID) },
    );

    expect(response.status).toBe(400);
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated request-traffic queries', async () => {
    const response = await SELF.fetch(
      'https://test.local/admin/request-traffic?from=2026-08-31T00%3A00%3A00Z&to=2026-08-31T01%3A00%3A00Z',
    );

    expect(response.status).toBe(401);
  });
});
