/**
 * Daily login reward — integration tests
 *
 * Tests the POST /api/gacha/daily-reward endpoint and GET /api/gacha/status.
 * Runs in Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { requireCanonicalIsoTimestamp } from '../../../platform/time/canonicalIsoTimestamp';

const JWT_SECRET = new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production');
const TEST_USER_ID = 'daily-reward-test-user';

const dailyRewardResponseSchema = z.discriminatedUnion('claimed', [
  z.strictObject({
    claimed: z.literal(true),
    normalDrawsAdded: z.number().int().min(1).max(5),
    goldenDrawsAdded: z.literal(1),
  }),
  z.strictObject({ claimed: z.literal(false), reason: z.literal('cooldown') }),
]);
const gachaStatusResponseSchema = z.strictObject({
  normalDraws: z.number().int().nonnegative(),
  goldenDraws: z.number().int().nonnegative(),
  normalPity: z.number().int().nonnegative(),
  goldenPity: z.number().int().nonnegative(),
  shards: z.number().int().nonnegative(),
  unlockedCount: z.number().int().nonnegative(),
});

async function mintToken(userId: string = TEST_USER_ID): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: userId, ver: 0, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

async function postJson(path: string, body: unknown, token: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function getJson(path: string, token: string): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function ensureUser(userId: string = TEST_USER_ID): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO users (id, is_anonymous, created_at, updated_at)
     VALUES (?, 1, datetime('now'), datetime('now'))`,
  )
    .bind(userId)
    .run();
}

async function cleanStats(userId: string = TEST_USER_ID): Promise<void> {
  await env.DB.prepare(`DELETE FROM user_stats WHERE user_id = ?`).bind(userId).run();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/gacha/daily-reward', () => {
  beforeEach(async () => {
    await ensureUser();
    await cleanStats();
  });

  it('grants 1–5 normal draws + 1 golden draw on first claim (no user_stats row)', async () => {
    const token = await mintToken();
    const res = await postJson('/api/gacha/daily-reward', {}, token);
    expect(res.status).toBe(200);
    const body = dailyRewardResponseSchema.parse(await res.json());
    expect(body.claimed).toBe(true);
    if (!body.claimed) throw new Error('Expected a granted daily reward');
    expect(body.normalDrawsAdded).toBeGreaterThanOrEqual(1);
    expect(body.normalDrawsAdded).toBeLessThanOrEqual(5);
    expect(body.goldenDrawsAdded).toBe(1);

    // Verify via GET /api/gacha/status
    const statusRes = await getJson('/api/gacha/status', token);
    const status = gachaStatusResponseSchema.parse(await statusRes.json());
    expect(status.normalDraws).toBe(body.normalDrawsAdded);
    expect(status.goldenDraws).toBe(1);

    const row = await env.DB.prepare(
      `SELECT last_login_reward_at FROM user_stats WHERE user_id = ?`,
    )
      .bind(TEST_USER_ID)
      .first<{ last_login_reward_at: string }>();
    if (row === null) throw new Error('Expected persisted daily reward timestamp');
    expect(requireCanonicalIsoTimestamp(row.last_login_reward_at, 'last_login_reward_at')).toBe(
      row.last_login_reward_at,
    );
  });

  it('rejects rapid double claim via cooldown', async () => {
    const token = await mintToken();
    await postJson('/api/gacha/daily-reward', {}, token);
    const res = await postJson('/api/gacha/daily-reward', {}, token);
    expect(res.status).toBe(200);
    const body = dailyRewardResponseSchema.parse(await res.json());
    expect(body.claimed).toBe(false);
    if (body.claimed) throw new Error('Expected daily reward cooldown');
    expect(body.reason).toBe('cooldown');
  });

  it('grants exactly one reward when first claims arrive concurrently', async () => {
    const token = await mintToken();
    const [leftResponse, rightResponse] = await Promise.all([
      postJson('/api/gacha/daily-reward', {}, token),
      postJson('/api/gacha/daily-reward', {}, token),
    ]);
    expect([leftResponse.status, rightResponse.status]).toEqual([200, 200]);

    const [left, right] = await Promise.all([
      leftResponse.json().then((value) => dailyRewardResponseSchema.parse(value)),
      rightResponse.json().then((value) => dailyRewardResponseSchema.parse(value)),
    ]);
    const granted = [left, right].filter((result) => result.claimed);
    const rejected = [left, right].filter((result) => !result.claimed);
    expect(granted).toHaveLength(1);
    expect(rejected).toEqual([{ claimed: false, reason: 'cooldown' }]);

    const grantedReward = granted[0];
    if (grantedReward === undefined || !grantedReward.claimed) {
      throw new Error('Expected exactly one granted daily reward');
    }
    const statusResponse = await getJson('/api/gacha/status', token);
    const status = gachaStatusResponseSchema.parse(await statusResponse.json());
    expect(status.normalDraws).toBe(grantedReward.normalDrawsAdded);
    expect(status.goldenDraws).toBe(grantedReward.goldenDrawsAdded);
  });

  it('rejects unknown request fields instead of stripping them', async () => {
    const token = await mintToken();
    const res = await postJson('/api/gacha/daily-reward', { localDate: '2026-07-15' }, token);

    expect(res.status).toBe(400);
  });

  it('allows claim after cooldown expires', async () => {
    const token = await mintToken();
    // Simulate a claim 21 hours ago (past the 20h cooldown)
    const twentyOneHoursAgo = new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, normal_draws, golden_draws, version, last_login_reward_at, updated_at)
       VALUES (?, 3, 2, 1, ?, datetime('now'))`,
    )
      .bind(TEST_USER_ID, twentyOneHoursAgo)
      .run();

    const res = await postJson('/api/gacha/daily-reward', {}, token);
    expect(res.status).toBe(200);
    const body = dailyRewardResponseSchema.parse(await res.json());
    expect(body.claimed).toBe(true);
    if (!body.claimed) throw new Error('Expected a granted daily reward');
    expect(body.normalDrawsAdded).toBeGreaterThanOrEqual(1);
    expect(body.normalDrawsAdded).toBeLessThanOrEqual(5);
    expect(body.goldenDrawsAdded).toBe(1);

    const statusRes = await getJson('/api/gacha/status', token);
    const status = gachaStatusResponseSchema.parse(await statusRes.json());
    // 3 (pre-seeded) + random draws added
    expect(status.normalDraws).toBe(3 + body.normalDrawsAdded);
    // 2 (pre-seeded) + 1 golden draw
    expect(status.goldenDraws).toBe(3);
  });

  it('rejects claim within 20h cooldown', async () => {
    const token = await mintToken();
    // Simulate a claim that happened 1 hour ago (ISO datetime)
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, normal_draws, version, last_login_reward_at, updated_at)
       VALUES (?, 0, 1, ?, datetime('now'))`,
    )
      .bind(TEST_USER_ID, oneHourAgo)
      .run();

    const res = await postJson('/api/gacha/daily-reward', {}, token);
    expect(res.status).toBe(200);
    const body = dailyRewardResponseSchema.parse(await res.json());
    expect(body.claimed).toBe(false);
    if (body.claimed) throw new Error('Expected daily reward cooldown');
    expect(body.reason).toBe('cooldown');
  });

  it('fails fast when a persisted cooldown timestamp is malformed', async () => {
    const token = await mintToken();
    await env.DB.exec(`
      DROP TRIGGER user_stats_last_login_reward_at_insert;
      DROP TRIGGER user_stats_last_login_reward_at_update;
    `);
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, last_login_reward_at, updated_at)
       VALUES (?, '', datetime('now'))`,
    )
      .bind(TEST_USER_ID)
      .run();

    const res = await postJson('/api/gacha/daily-reward', {}, token);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      success: false,
      reason: 'INTERNAL_ERROR',
    });
  });
});

describe('GET /api/gacha/status', () => {
  beforeEach(async () => {
    await ensureUser();
    await cleanStats();
  });

  it('returns zeroed public counters without exposing the internal cooldown timestamp', async () => {
    const token = await mintToken();
    const res = await getJson('/api/gacha/status', token);
    const body = gachaStatusResponseSchema.parse(await res.json());
    expect(body).toEqual({
      normalDraws: 0,
      goldenDraws: 0,
      normalPity: 0,
      goldenPity: 0,
      shards: 0,
      unlockedCount: 0,
    });
  });
});
