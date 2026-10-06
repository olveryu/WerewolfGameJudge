/**
 * Admin room list — integration tests
 *
 * Verifies GET /admin/rooms returns the per-room game-start visibility fields
 * (gamesStarted / lastStartedAt) added in migration 0031, so the admin portal can
 * tell played vs never-played rooms without opening each room. Runs in the Workers
 * runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN_TOKEN = 'test-admin-token-do-not-use-in-production';
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

async function getRooms(token: string): Promise<Response> {
  return SELF.fetch('https://test.local/admin/rooms', {
    headers: { 'X-Admin-Token': token },
  });
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users (id, display_name, last_country, is_anonymous, created_at, updated_at)
     VALUES (?, 'AdminHost', 'JP', 0, datetime('now'), datetime('now'))`,
  )
    .bind(HOST_USER_ID)
    .run();
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

describe('GET /admin/rooms game-start visibility', () => {
  it('returns gamesStarted + lastStartedAt for a played room', async () => {
    const startedAt = '2026-06-30T08:15:00.000Z';
    await insertRoom('room-played', '1111', 3, startedAt);

    const res = await getRooms(ADMIN_TOKEN);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === '1111');
    if (!room) throw new Error('room 1111 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(3);
    expect(room.lastStartedAt).toBe(startedAt);
    expect(room.hostName).toBe('AdminHost');
    expect(room.hostCountry).toBe('JP');
  });

  it('returns zero / null for a never-started room', async () => {
    await insertRoom('room-fresh', '2222', 0, null);

    const res = await getRooms(ADMIN_TOKEN);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === '2222');
    if (!room) throw new Error('room 2222 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(0);
    expect(room.lastStartedAt).toBeNull();
  });

  it('rejects requests without the admin token', async () => {
    await insertRoom('room-auth', '3333', 1, null);

    const res = await SELF.fetch('https://test.local/admin/rooms');
    expect(res.status).toBe(401);
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
      { headers: { 'X-Admin-Token': ADMIN_TOKEN } },
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
      'https://test.local/admin/request-traffic?from=2026-07-01T00%3A00%3A00Z&to=2026-08-31T00%3A00%3A00Z',
      { headers: { 'X-Admin-Token': ADMIN_TOKEN } },
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
