/**
 * Daily login reward — integration tests
 *
 * Tests the POST /api/gacha/daily-reward endpoint and GET /api/gacha/status.
 * Runs in Workers runtime via @cloudflare/vitest-pool-workers with D1.
 */

import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const JWT_SECRET = new TextEncoder().encode('e2e-test-jwt-secret-do-not-use-in-production');
const TEST_USER_ID = 'daily-reward-test-user';

async function mintToken(userId: string = TEST_USER_ID): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: userId, ver: 0, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
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

// ── Schema bootstrap (vitest D1 starts empty) ──────────────────────────────

beforeAll(async () => {
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT, avatar_url TEXT, custom_avatar_url TEXT, avatar_frame TEXT, equipped_flair TEXT, equipped_name_style TEXT, equipped_effect TEXT, equipped_seat_animation TEXT, wechat_openid TEXT, is_anonymous INTEGER NOT NULL DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 0, last_country TEXT, last_colo TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS refresh_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));`,
  );
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS user_stats (user_id TEXT PRIMARY KEY REFERENCES users(id), xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 0, games_played INTEGER NOT NULL DEFAULT 0, last_room_code TEXT, unlocked_items TEXT NOT NULL DEFAULT '[]', normal_draws INTEGER NOT NULL DEFAULT 0, golden_draws INTEGER NOT NULL DEFAULT 0, normal_pity INTEGER NOT NULL DEFAULT 0, golden_pity INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0, last_login_reward_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));`,
  );
});

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

  it('grants 2 normal draws on first claim (no user_stats row)', async () => {
    const token = await mintToken();
    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(true);
    expect(body.normalDrawsAdded).toBe(2);

    // Verify via GET /api/gacha/status
    const statusRes = await getJson('/api/gacha/status', token);
    const status = await statusRes.json();
    expect(status.normalDraws).toBe(2);
    expect(status.lastLoginRewardAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects rapid double claim via cooldown', async () => {
    const token = await mintToken();
    await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(false);
    expect(body.reason).toBe('cooldown');
  });

  it('allows claim after cooldown expires', async () => {
    const token = await mintToken();
    // Simulate a claim 21 hours ago (past the 20h cooldown)
    const twentyOneHoursAgo = new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, normal_draws, version, last_login_reward_at, updated_at)
       VALUES (?, 3, 1, ?, datetime('now'))`,
    )
      .bind(TEST_USER_ID, twentyOneHoursAgo)
      .run();

    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(true);
    expect(body.normalDrawsAdded).toBe(2);

    const statusRes = await getJson('/api/gacha/status', token);
    const status = await statusRes.json();
    expect(status.normalDraws).toBe(5);
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

    // Try claiming with "tomorrow" as localDate — different date string, but < 20h
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

    const res = await postJson('/api/gacha/daily-reward', { localDate: tomorrowStr }, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(false);
    expect(body.reason).toBe('cooldown');
  });
});

describe('GET /api/gacha/status — lastLoginRewardAt', () => {
  beforeEach(async () => {
    await ensureUser();
    await cleanStats();
  });

  it('returns null lastLoginRewardAt for new users', async () => {
    const token = await mintToken();
    const res = await getJson('/api/gacha/status', token);
    const body = await res.json();
    expect(body.lastLoginRewardAt).toBeNull();
  });

  it('returns lastLoginRewardAt after daily claim', async () => {
    const token = await mintToken();
    await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);

    const res = await getJson('/api/gacha/status', token);
    const body = await res.json();
    expect(body.lastLoginRewardAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
