/**
 * Werewolf public statistics — integration tests
 *
 * Verifies the game-routed stats endpoint and its two-hour anti-cheat visibility boundary.
 * Runs in Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestSchema } from '../../../__tests__/testSchemaBootstrap';

const JWT_SECRET = new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production');
const TARGET_USER_ID = 'camp-stats-target-user';
const VIEWER_USER_ID = 'camp-stats-viewer-user';

async function mintToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: userId, ver: 0, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

async function getJson(path: string, token: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

interface CampStatsResponse {
  gameType: 'werewolf';
  campStats: { total: number; counts: Record<string, number> };
}

const werewolfStatsPath = `/api/games/werewolf/users/${TARGET_USER_ID}/stats`;

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

async function ensureUser(userId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES (?, 'CampUser', 0, datetime('now'), datetime('now'))`,
  )
    .bind(userId)
    .run();
}

/** Insert a camp settlement row with settled_at offset by the given minutes (negative = past). */
async function insertCampRow(
  userId: string,
  settleKey: string,
  camp: string,
  minutesAgo: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO camp_settlements (user_id, settle_key, camp, settled_at)
     VALUES (?, ?, ?, datetime('now', ?))`,
  )
    .bind(userId, settleKey, camp, `-${minutesAgo} minutes`)
    .run();
}

beforeEach(async () => {
  await ensureUser(TARGET_USER_ID);
  await ensureUser(VIEWER_USER_ID);
  await env.DB.prepare('DELETE FROM camp_settlements WHERE user_id = ?').bind(TARGET_USER_ID).run();
});

describe('camp statistics visibility', () => {
  it('self view also applies the 2h delay (hides recent games)', async () => {
    await insertCampRow(TARGET_USER_ID, 'r1:0', 'wolf', 1); // 1 min ago → hidden
    await insertCampRow(TARGET_USER_ID, 'r2:0', 'god', 200); // >2h ago → visible

    const res = await getJson(werewolfStatsPath, await mintToken(TARGET_USER_ID));
    expect(res.status).toBe(200);
    const body = await res.json<CampStatsResponse>();
    expect(body.gameType).toBe('werewolf');
    expect(body.campStats.total).toBe(1);
    expect(body.campStats.counts.god).toBe(1);
    expect(body.campStats.counts.wolf).toBe(0);
  });

  it('public view hides games settled less than 2 hours ago', async () => {
    await insertCampRow(TARGET_USER_ID, 'r1:0', 'wolf', 119); // 1h59m ago → hidden
    await insertCampRow(TARGET_USER_ID, 'r2:0', 'god', 121); // 2h01m ago → visible

    const res = await getJson(werewolfStatsPath, await mintToken(VIEWER_USER_ID));
    expect(res.status).toBe(200);
    const body = await res.json<CampStatsResponse>();
    expect(body.campStats.total).toBe(1);
    expect(body.campStats.counts.god).toBe(1);
    expect(body.campStats.counts.wolf).toBe(0);
  });

  it('public view counts a game once it crosses the 2 hour boundary', async () => {
    await insertCampRow(TARGET_USER_ID, 'r1:0', 'villager', 121); // 2h01m ago → visible

    const selfRes = await getJson(werewolfStatsPath, await mintToken(TARGET_USER_ID));
    const publicRes = await getJson(werewolfStatsPath, await mintToken(VIEWER_USER_ID));
    const selfBody = await selfRes.json<CampStatsResponse>();
    const publicBody = await publicRes.json<CampStatsResponse>();

    expect(selfBody.campStats.counts.villager).toBe(1);
    expect(publicBody.campStats.counts.villager).toBe(1);
  });

  it('keeps platform profile and growth payloads free of game statistics', async () => {
    const token = await mintToken(TARGET_USER_ID);
    const profileRes = await getJson(`/api/user/${TARGET_USER_ID}/profile`, token);
    const growthRes = await getJson('/api/user/stats', token);
    const profileBody = await profileRes.json<Record<string, unknown>>();
    const growthBody = await growthRes.json<Record<string, unknown>>();

    expect(profileBody).not.toHaveProperty('campStats');
    expect(growthBody).not.toHaveProperty('campStats');
  });

  it('rejects an unregistered game type before module dispatch', async () => {
    const res = await getJson(
      `/api/games/unregistered/users/${TARGET_USER_ID}/stats`,
      await mintToken(VIEWER_USER_ID),
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      success: false,
      reason: 'GAME_TYPE_NOT_FOUND',
    });
  });
});
