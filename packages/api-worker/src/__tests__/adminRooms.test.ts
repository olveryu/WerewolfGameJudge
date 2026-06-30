/**
 * Admin room list — integration tests
 *
 * Verifies GET /admin/rooms returns the per-room game-start visibility fields
 * (gamesStarted / lastStartedAt) added in migration 0031, so the admin portal can
 * tell played vs never-played rooms without opening each room. Runs in the Workers
 * runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestSchema } from './testSchemaBootstrap';

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

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users (id, display_name, last_country, is_anonymous, created_at, updated_at)
     VALUES (?, 'AdminHost', 'JP', 0, datetime('now'), datetime('now'))`,
  )
    .bind(HOST_USER_ID)
    .run();
});

/** Insert a room row with explicit game-start fields. */
async function insertRoom(
  id: string,
  code: string,
  gamesStarted: number,
  lastStartedAt: string | null,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO rooms (id, code, host_user_id, created_at, updated_at, games_started, last_started_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?)`,
  )
    .bind(id, code, HOST_USER_ID, gamesStarted, lastStartedAt)
    .run();
}

describe('GET /admin/rooms game-start visibility', () => {
  it('returns gamesStarted + lastStartedAt for a played room', async () => {
    const startedAt = '2026-06-30T08:15:00.000Z';
    await insertRoom('room-played', 'PLAY1', 3, startedAt);

    const res = await getRooms(ADMIN_TOKEN);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === 'PLAY1');
    if (!room) throw new Error('room PLAY1 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(3);
    expect(room.lastStartedAt).toBe(startedAt);
    expect(room.hostName).toBe('AdminHost');
    expect(room.hostCountry).toBe('JP');
  });

  it('returns zero / null for a never-started room', async () => {
    await insertRoom('room-fresh', 'FRESH1', 0, null);

    const res = await getRooms(ADMIN_TOKEN);
    expect(res.status).toBe(200);

    const body = await res.json<AdminRoomsResponse>();
    const room = body.rooms.find((r) => r.code === 'FRESH1');
    if (!room) throw new Error('room FRESH1 missing from /admin/rooms response');
    expect(room.gamesStarted).toBe(0);
    expect(room.lastStartedAt).toBeNull();
  });

  it('rejects requests without the admin token', async () => {
    await insertRoom('room-auth', 'AUTH1', 1, null);

    const res = await SELF.fetch('https://test.local/admin/rooms');
    expect(res.status).toBe(401);
  });
});
