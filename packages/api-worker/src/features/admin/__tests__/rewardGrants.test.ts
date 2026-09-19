/** Admin grants use real D1 transactions, authentication, and immutable replay records. */
import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const ADMIN_TOKEN = 'test-admin-token-do-not-use-in-production';
const USER_ID = 'admin-reward-user';
const URL = `https://test.local/admin/users/${USER_ID}/rewards`;

function createGrant() {
  return { id: crypto.randomUUID(), drawType: 'golden', count: 100, reason: '活动奖励' };
}

function sendGrant(body: unknown, token = ADMIN_TOKEN, url = URL) {
  return SELF.fetch(url, {
    method: 'POST',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readRewards() {
  const response = await SELF.fetch(URL, { headers: { 'X-Admin-Token': ADMIN_TOKEN } });
  expect(response.status).toBe(200);
  return response.json<{ normalDraws: number; goldenDraws: number; grants: unknown[] }>();
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES (?, 'Reward recipient', 1, datetime('now'), datetime('now'))`,
  )
    .bind(USER_ID)
    .run();
});

describe('admin reward grants', () => {
  it('creates missing stats, preserves other balances, and returns audit history', async () => {
    expect(await readRewards()).toEqual({ normalDraws: 0, goldenDraws: 0, grants: [] });
    const request = createGrant();
    const response = await sendGrant(request);
    expect(response.status).toBe(200);
    const grant = await response.json();
    expect(grant).toMatchObject({
      ...request,
      userId: USER_ID,
      balanceBefore: 0,
      balanceAfter: 100,
    });
    const normal = await sendGrant({ ...createGrant(), drawType: 'normal', count: 5 });
    expect(normal.status).toBe(200);
    const rewards = await readRewards();
    expect(rewards).toMatchObject({ normalDraws: 5, goldenDraws: 100 });
    expect(rewards.grants).toContainEqual(grant);
    expect(
      await env.DB.prepare('SELECT version FROM user_stats WHERE user_id = ?')
        .bind(USER_ID)
        .first(),
    ).toEqual({ version: 2 });
  });

  it('applies a concurrent duplicate once and replays the original result after spending', async () => {
    const request = createGrant();
    const responses = await Promise.all([sendGrant(request), sendGrant(request)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const grants = await Promise.all(responses.map((response) => response.json()));
    expect(grants[0]).toEqual(grants[1]);
    await env.DB.prepare(
      'UPDATE user_stats SET golden_draws = golden_draws - 10, version = version + 1 WHERE user_id = ?',
    )
      .bind(USER_ID)
      .run();
    const replay = await sendGrant(request);
    expect(await replay.json()).toEqual(grants[0]);
    expect(await readRewards()).toMatchObject({ goldenDraws: 90, grants: [grants[0]] });
  });

  it('accumulates independent concurrent grants', async () => {
    const responses = await Promise.all([sendGrant(createGrant()), sendGrant(createGrant())]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await readRewards()).toMatchObject({ goldenDraws: 200 });
  });

  it('rejects reuse of an ID with different grant contents or recipient', async () => {
    const request = createGrant();
    expect((await sendGrant(request)).status).toBe(200);
    expect((await sendGrant({ ...request, count: 200 })).status).toBe(409);
    expect(
      (await sendGrant(request, ADMIN_TOKEN, 'https://test.local/admin/users/other/rewards'))
        .status,
    ).toBe(409);
    expect(await readRewards()).toMatchObject({ goldenDraws: 100 });
  });

  it.each([0, -1, 1.5, 10001])(
    'rejects invalid count %s without changing balances',
    async (count) => {
      expect((await sendGrant({ ...createGrant(), count })).status).toBe(400);
      expect(await readRewards()).toEqual({ normalDraws: 0, goldenDraws: 0, grants: [] });
    },
  );

  it('requires administrator credentials for reading and granting', async () => {
    expect((await SELF.fetch(URL)).status).toBe(401);
    expect((await sendGrant(createGrant(), 'wrong-token')).status).toBe(403);
    expect(await readRewards()).toEqual({ normalDraws: 0, goldenDraws: 0, grants: [] });
  });

  it('does not create a grant for a missing user', async () => {
    expect(
      (
        await sendGrant(
          createGrant(),
          ADMIN_TOKEN,
          'https://test.local/admin/users/missing/rewards',
        )
      ).status,
    ).toBe(404);
  });
});
