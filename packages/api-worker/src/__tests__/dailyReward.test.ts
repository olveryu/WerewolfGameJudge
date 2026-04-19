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
  return new SignJWT({ sub: userId, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
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
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT, avatar_url TEXT, custom_avatar_url TEXT, avatar_frame TEXT, equipped_flair TEXT, equipped_name_style TEXT, wechat_openid TEXT, is_anonymous INTEGER NOT NULL DEFAULT 1, last_country TEXT, last_colo TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));`,
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

  it('grants 1 normal draw on first claim (no user_stats row)', async () => {
    const token = await mintToken();
    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claimed: boolean; normalDrawsAdded?: number };
    expect(body.claimed).toBe(true);
    expect(body.normalDrawsAdded).toBe(1);

    // Verify via GET /api/gacha/status
    const statusRes = await getJson('/api/gacha/status', token);
    const status = (await statusRes.json()) as {
      normalDraws: number;
      lastLoginRewardAt: string | null;
    };
    expect(status.normalDraws).toBe(1);
    expect(status.lastLoginRewardAt).toBe(todayLocal());
  });

  it('rejects duplicate claim on same local date', async () => {
    const token = await mintToken();
    await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claimed: boolean; reason?: string };
    expect(body.claimed).toBe(false);
    expect(body.reason).toBe('already_claimed');
  });

  it('allows claim on a new day', async () => {
    const token = await mintToken();
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, normal_draws, version, last_login_reward_at, updated_at)
       VALUES (?, 3, 1, ?, datetime('now'))`,
    )
      .bind(TEST_USER_ID, yesterdayLocal())
      .run();

    const res = await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claimed: boolean; normalDrawsAdded?: number };
    expect(body.claimed).toBe(true);
    expect(body.normalDrawsAdded).toBe(1);

    const statusRes = await getJson('/api/gacha/status', token);
    const status = (await statusRes.json()) as { normalDraws: number };
    expect(status.normalDraws).toBe(4);
  });

  it('rejects claim within 20h cooldown', async () => {
    const token = await mintToken();
    const today = todayLocal();
    await env.DB.prepare(
      `INSERT INTO user_stats (user_id, normal_draws, version, last_login_reward_at, updated_at)
       VALUES (?, 0, 1, ?, datetime('now'))`,
    )
      .bind(TEST_USER_ID, today)
      .run();

    // Try claiming with "tomorrow" as localDate — different string, but < 20h
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

    const res = await postJson('/api/gacha/daily-reward', { localDate: tomorrowStr }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { claimed: boolean; reason?: string };
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
    const body = (await res.json()) as { lastLoginRewardAt: string | null };
    expect(body.lastLoginRewardAt).toBeNull();
  });

  it('returns lastLoginRewardAt after daily claim', async () => {
    const token = await mintToken();
    await postJson('/api/gacha/daily-reward', { localDate: todayLocal() }, token);

    const res = await getJson('/api/gacha/status', token);
    const body = (await res.json()) as { lastLoginRewardAt: string | null };
    expect(body.lastLoginRewardAt).toBe(todayLocal());
  });
});
