/** Gacha idempotency replay ownership and persisted-payload tests. */

import { RARITIES, REWARD_POOL_BY_ID, REWARD_TYPES } from '@game-judge/game-engine/product/rewards';
import { env, SELF } from 'cloudflare:test';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

const USER_ID = 'gacha-idempotency-user';
const OTHER_USER_ID = 'gacha-idempotency-other-user';
const IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000001';
const SECOND_IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000002';

const drawResponseSchema = z.strictObject({
  results: z.array(
    z.strictObject({
      rarity: z.enum(RARITIES),
      rewardType: z.enum(REWARD_TYPES),
      rewardId: z.string(),
      isNew: z.boolean(),
      isPityTriggered: z.boolean(),
      isDuplicate: z.boolean(),
      shardsAwarded: z.number().int().nonnegative(),
    }),
  ),
  totalShardsAwarded: z.number().int().nonnegative(),
  remaining: z.strictObject({
    normalDraws: z.number().int().nonnegative(),
    goldenDraws: z.number().int().nonnegative(),
  }),
});

async function mintToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ver: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

async function draw(token: string, idempotencyKey: string = IDEMPOTENCY_KEY): Promise<Response> {
  return SELF.fetch('https://test.local/api/gacha/draw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ drawType: 'normal', count: 1, idempotencyKey }),
  });
}

async function exchange(token: string, idempotencyKey: string): Promise<Response> {
  return SELF.fetch('https://test.local/api/gacha/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rewardId: 'avenger', idempotencyKey }),
  });
}

async function storeRawReplay(input: {
  userId: string;
  response: string;
  operation?: 'draw' | 'exchange';
  isApplied?: 0 | 1;
}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO idempotency_keys (
       key, user_id, claim_id, operation, is_applied, response, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      IDEMPOTENCY_KEY,
      input.userId,
      crypto.randomUUID(),
      input.operation ?? 'draw',
      input.isApplied ?? 1,
      input.response,
    )
    .run();
}

function storeReplay(userId: string, response: unknown): Promise<void> {
  return storeRawReplay({ userId, response: JSON.stringify(response) });
}

async function seedStats(userId: string, normalDraws: number = 5): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_stats (user_id, normal_draws, updated_at)
     VALUES (?, ?, datetime('now'))`,
  )
    .bind(userId, normalDraws)
    .run();
}

async function readMutationCounts(userId: string): Promise<{
  normal_draws: number;
  version: number;
  history_count: number;
  ledger_count: number;
}> {
  const row = await env.DB.prepare(
    `SELECT
       stats.normal_draws,
       stats.version,
       (SELECT COUNT(*) FROM draw_history WHERE user_id = ?1) AS history_count,
       (SELECT COUNT(*) FROM idempotency_keys WHERE user_id = ?1 AND is_applied = 1)
         AS ledger_count
     FROM user_stats AS stats
     WHERE stats.user_id = ?1`,
  )
    .bind(userId)
    .first<{
      normal_draws: number;
      version: number;
      history_count: number;
      ledger_count: number;
    }>();
  if (row === null) throw new Error(`Expected stats for ${userId}`);
  return row;
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM idempotency_keys;');
  await env.DB.exec('DELETE FROM user_stats;');
  await env.DB.exec('DELETE FROM users;');
  await env.DB.prepare(
    `INSERT INTO users (id, is_anonymous, created_at, updated_at)
     VALUES (?, 1, datetime('now'), datetime('now')), (?, 1, datetime('now'), datetime('now'))`,
  )
    .bind(USER_ID, OTHER_USER_ID)
    .run();
});

describe('gacha idempotency replay', () => {
  it('returns a schema-validated replay owned by the authenticated user', async () => {
    const reward = REWARD_POOL_BY_ID.get('avenger');
    if (reward === undefined) throw new Error('Expected avenger reward fixture');
    const replay = {
      results: [
        {
          rarity: reward.rarity,
          rewardType: reward.type,
          rewardId: reward.id,
          isNew: true,
          isPityTriggered: false,
          isDuplicate: false,
          shardsAwarded: 0,
        },
      ],
      totalShardsAwarded: 0,
      remaining: { normalDraws: 4, goldenDraws: 1 },
    };
    await storeReplay(USER_ID, replay);

    const response = await draw(await mintToken(USER_ID));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(replay);
  });

  it('fails fast when persisted replay JSON violates its operation schema', async () => {
    await storeReplay(USER_ID, { results: [] });

    const response = await draw(await mintToken(USER_ID));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'INTERNAL_ERROR',
    });
  });

  it('classifies malformed persisted JSON as a server invariant failure', async () => {
    await storeRawReplay({ userId: USER_ID, response: '{' });

    const response = await draw(await mintToken(USER_ID));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'INTERNAL_ERROR',
    });
  });

  it('fails fast when a non-applied ledger row becomes externally visible', async () => {
    await storeRawReplay({ userId: USER_ID, response: '{}', isApplied: 0 });

    const response = await draw(await mintToken(USER_ID));
    expect(response.status).toBe(500);
  });

  it('does not replay another user idempotency record', async () => {
    await storeReplay(OTHER_USER_ID, { leaked: true });
    await seedStats(USER_ID);

    const response = await draw(await mintToken(USER_ID));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      reason: 'CONFLICT',
    });

    await expect(readMutationCounts(USER_ID)).resolves.toEqual({
      normal_draws: 5,
      version: 0,
      history_count: 0,
      ledger_count: 0,
    });
  });

  it('rejects reusing a draw key for a different operation', async () => {
    const reward = REWARD_POOL_BY_ID.get('avenger');
    if (reward === undefined) throw new Error('Expected avenger reward fixture');
    await storeReplay(USER_ID, {
      results: [
        {
          rarity: reward.rarity,
          rewardType: reward.type,
          rewardId: reward.id,
          isNew: true,
          isPityTriggered: false,
          isDuplicate: false,
          shardsAwarded: 0,
        },
      ],
      totalShardsAwarded: 0,
      remaining: { normalDraws: 4, goldenDraws: 0 },
    });

    const response = await exchange(await mintToken(USER_ID), IDEMPOTENCY_KEY);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, reason: 'CONFLICT' });
  });

  it('applies concurrent requests with the same key exactly once', async () => {
    await seedStats(USER_ID);
    const token = await mintToken(USER_ID);

    const [leftResponse, rightResponse] = await Promise.all([draw(token), draw(token)]);
    expect(leftResponse.status).toBe(200);
    expect(rightResponse.status).toBe(200);
    const [left, right] = await Promise.all([
      leftResponse.json().then((value) => drawResponseSchema.parse(value)),
      rightResponse.json().then((value) => drawResponseSchema.parse(value)),
    ]);
    expect(right).toEqual(left);
    await expect(readMutationCounts(USER_ID)).resolves.toEqual({
      normal_draws: 4,
      version: 1,
      history_count: 1,
      ledger_count: 1,
    });
  });

  it('serializes concurrent requests with different keys through OCC', async () => {
    await seedStats(USER_ID);
    const token = await mintToken(USER_ID);

    const responses = await Promise.all([
      draw(token, IDEMPOTENCY_KEY),
      draw(token, SECOND_IDEMPOTENCY_KEY),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expect(readMutationCounts(USER_ID)).resolves.toEqual({
      normal_draws: 3,
      version: 2,
      history_count: 2,
      ledger_count: 2,
    });
  });
});
