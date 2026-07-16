/**
 * Gacha feature routes.
 *
 * GET  /api/gacha/status   -- query current draw ticket counts + pity counters + shard balance
 * POST /api/gacha/draw     -- execute draw (deduct ticket + roll + unlock/shards + history)
 * POST /api/gacha/exchange -- exchange shards for a specific item
 *
 * Transactional: draw/exchange commit ledger, history, and stats in one D1 batch; daily-reward
 * uses userStats.version OCC. Version conflicts retry up to MAX_GACHA_OCC_ATTEMPTS times.
 *
 * @throws Per-route error codes:
 * - POST /gacha/draw -- 400 NO_STATS | 400 INSUFFICIENT_DRAWS | 409 CONFLICT (OCC exhausted)
 * - POST /gacha/daily-reward -- 400 NO_STATS | 400 COOLDOWN_NOT_MET | 409 CONFLICT
 * - POST /gacha/exchange -- 400 INVALID_ITEM | 400 NO_STATS | 400 INSUFFICIENT_SHARDS |
 *     400 ALREADY_OWNED | 409 CONFLICT
 *
 * @pre All routes require requireAuth middleware (Bearer token authentication)
 * @pre idempotencyKey uniquely identifies this operation; replays return cached response (24h TTL)
 */

import { secureRng } from '@game-judge/game-engine/platform/random';
import {
  parseUnlockedRewardIds,
  RARITIES,
  type Rarity,
  REWARD_POOL_BY_ID,
  REWARD_TYPES,
  rollNormalDraws,
  rollRarity,
  selectReward,
  SHARD_COSTS,
} from '@game-judge/game-engine/product/rewards';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { createDb } from '../../db';
import type { AppEnv } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import { createLogger } from '../../platform/observability/logger';
import { parseCanonicalIsoTimestampMs } from '../../platform/time/canonicalIsoTimestamp';
import { userStats } from '../account/dbSchema';
import { requireAuth } from '../auth/tokenAuth';
import {
  commitGachaDraw,
  commitGachaExchange,
  type GachaDrawHistoryEntry,
  readGachaReplay,
} from './mutationLedger';
import { dailyRewardSchema, gachaDrawSchema, shardExchangeSchema } from './schemas';

const log = createLogger('gacha');

/** Gacha system routes (draws / daily reward / unlocks). */
export const gachaRoutes = new Hono<AppEnv>();

/** Minimum hours between daily reward claims (server-side cooldown guard) */
const DAILY_REWARD_COOLDOWN_HOURS = 20;

/** GET /api/gacha/status */
gachaRoutes.get('/gacha/status', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;

  const stats = await db
    .select({
      normalDraws: userStats.normalDraws,
      goldenDraws: userStats.goldenDraws,
      normalPity: userStats.normalPity,
      goldenPity: userStats.goldenPity,
      shards: userStats.shards,
      unlockedItems: userStats.unlockedItems,
    })
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .get();

  if (!stats) {
    return c.json({
      normalDraws: 0,
      goldenDraws: 0,
      normalPity: 0,
      goldenPity: 0,
      shards: 0,
      unlockedCount: 0,
    });
  }

  const unlockedItems = parseUnlockedRewardIds(stats.unlockedItems);

  return c.json({
    normalDraws: stats.normalDraws,
    goldenDraws: stats.goldenDraws,
    normalPity: stats.normalPity,
    goldenPity: stats.goldenPity,
    shards: stats.shards,
    unlockedCount: unlockedItems.length,
  });
});

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const rewardIdSchema = z.string().refine((rewardId) => REWARD_POOL_BY_ID.has(rewardId), {
  error: 'Unknown persisted reward ID',
});
const drawResultSchema = z.strictObject({
  rarity: z.enum(RARITIES),
  rewardType: z.enum(REWARD_TYPES),
  rewardId: rewardIdSchema,
  isNew: z.boolean(),
  isPityTriggered: z.boolean(),
  isDuplicate: z.boolean(),
  shardsAwarded: nonnegativeIntegerSchema,
});
const drawResponseSchema = z.strictObject({
  results: z.array(drawResultSchema).min(1),
  totalShardsAwarded: nonnegativeIntegerSchema,
  remaining: z.strictObject({
    normalDraws: nonnegativeIntegerSchema,
    goldenDraws: nonnegativeIntegerSchema,
  }),
});
const exchangeResponseSchema = z.strictObject({
  rewardId: rewardIdSchema,
  rewardType: z.enum(REWARD_TYPES),
  rarity: z.enum(RARITIES),
  cost: nonnegativeIntegerSchema,
  remainingShards: nonnegativeIntegerSchema,
});

type DrawResult = z.infer<typeof drawResultSchema>;
type DrawResponse = z.infer<typeof drawResponseSchema>;
type ExchangeResponse = z.infer<typeof exchangeResponseSchema>;

/** Max OCC attempts for one gacha mutation. */
const MAX_GACHA_OCC_ATTEMPTS = 3;

/** POST /api/gacha/draw */
gachaRoutes.post('/gacha/draw', requireAuth, jsonBody(gachaDrawSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const { drawType, count, idempotencyKey } = c.req.valid('json');
  log.info('draw request', { userId, drawType, count });

  const cached = await readGachaReplay(c.env.DB, {
    userId,
    key: idempotencyKey,
    operation: 'draw',
    responseSchema: drawResponseSchema,
  });
  if (cached.kind === 'conflict') {
    return c.json({ success: false, reason: 'CONFLICT' }, 409);
  }
  if (cached.kind === 'replay') {
    log.info('draw idempotent hit', { userId, idempotencyKey });
    return c.json(cached.response);
  }

  for (let attempt = 0; attempt < MAX_GACHA_OCC_ATTEMPTS; attempt++) {
    // 1. Read current stats (including version for OCC)
    const stats = await db
      .select({
        normalDraws: userStats.normalDraws,
        goldenDraws: userStats.goldenDraws,
        normalPity: userStats.normalPity,
        goldenPity: userStats.goldenPity,
        unlockedItems: userStats.unlockedItems,
        version: userStats.version,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();

    if (!stats) {
      log.warn('no stats row', { userId });
      return c.json({ success: false, reason: 'NO_STATS' }, 400);
    }

    // 2. Check sufficient tickets
    const availableTickets = drawType === 'golden' ? stats.goldenDraws : stats.normalDraws;
    if (availableTickets < count) {
      log.warn('insufficient draws', {
        userId,
        drawType,
        available: availableTickets,
        requested: count,
      });
      return c.json({ success: false, reason: 'INSUFFICIENT_DRAWS' }, 400);
    }

    // 3. Parse existing unlocked items
    const unlockedIds = parseUnlockedRewardIds(stats.unlockedItems);
    const unlockedSet = new Set(unlockedIds);

    let currentPity = drawType === 'golden' ? stats.goldenPity : stats.normalPity;
    const results: DrawResult[] = [];
    const historyEntries: GachaDrawHistoryEntry[] = [];

    let totalShardsAwarded = 0;
    const now = new Date().toISOString();

    // 4. Execute draws
    for (let i = 0; i < count; i++) {
      const randomValue = secureRng() * 100;
      const { rarity, pityReset } = rollRarity(drawType, currentPity, randomValue);

      const result = selectReward(rarity, unlockedSet, secureRng);
      const { reward, isDuplicate, shardsAwarded } = result;

      if (!isDuplicate) {
        unlockedSet.add(reward.id);
      }
      totalShardsAwarded += shardsAwarded;

      results.push({
        rarity,
        rewardType: reward.type,
        rewardId: reward.id,
        isNew: !isDuplicate,
        isPityTriggered: pityReset,
        isDuplicate,
        shardsAwarded,
      });

      historyEntries.push({
        id: crypto.randomUUID(),
        drawType,
        rarity,
        rewardType: reward.type,
        rewardId: reward.id,
        pityCount: currentPity,
        isPityTriggered: pityReset ? 1 : 0,
        isDuplicate: isDuplicate ? 1 : 0,
        shardsAwarded,
        createdAt: now,
      });

      currentPity = pityReset ? 0 : currentPity + 1;
    }

    const updatedItems = JSON.stringify([...unlockedSet]);
    const response: DrawResponse = {
      results,
      totalShardsAwarded,
      remaining: {
        normalDraws: drawType === 'normal' ? availableTickets - count : stats.normalDraws,
        goldenDraws: drawType === 'golden' ? availableTickets - count : stats.goldenDraws,
      },
    };
    const committed = await commitGachaDraw(c.env.DB, {
      userId,
      key: idempotencyKey,
      drawType,
      expectedVersion: stats.version,
      count,
      nextPity: currentPity,
      unlockedItemsJson: updatedItems,
      shardsAwarded: totalShardsAwarded,
      historyEntries,
      response,
      responseSchema: drawResponseSchema,
    });
    if (committed.kind === 'conflict') {
      return c.json({ success: false, reason: 'CONFLICT' }, 409);
    }
    if (committed.kind === 'miss') continue;

    const rarities: Rarity[] = committed.response.results.map(
      (result: DrawResult): Rarity => result.rarity,
    );
    log.info('draw success', {
      userId,
      drawType,
      count,
      rarities,
      totalShardsAwarded: committed.response.totalShardsAwarded,
    });
    return c.json(committed.response);
  }

  // All retries exhausted -- concurrent conflict persisted
  log.error('OCC retries exhausted', { userId, drawType, count });
  return c.json({ success: false, reason: 'CONFLICT' }, 409);
});

/** POST /api/gacha/daily-reward -- daily login reward: claim normal draws + 1 golden draw */
gachaRoutes.post('/gacha/daily-reward', requireAuth, jsonBody(dailyRewardSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;

  for (let attempt = 0; attempt < MAX_GACHA_OCC_ATTEMPTS; attempt++) {
    const stats = await db
      .select({
        lastLoginRewardAt: userStats.lastLoginRewardAt,
        version: userStats.version,
        updatedAt: userStats.updatedAt,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();

    // ── No stats row yet -> exactly one concurrent request creates and claims it ──
    if (!stats) {
      const dailyDraws = rollNormalDraws();
      const claimedAt = new Date().toISOString();
      const inserted = await db
        .insert(userStats)
        .values({
          userId,
          normalDraws: dailyDraws,
          goldenDraws: 1,
          lastLoginRewardAt: claimedAt,
          updatedAt: claimedAt,
        })
        .onConflictDoNothing()
        .returning({ userId: userStats.userId });

      if (inserted.length === 1) {
        return c.json({ claimed: true, normalDrawsAdded: dailyDraws, goldenDrawsAdded: 1 });
      }
      if (inserted.length !== 0) {
        throw new Error(`[FAIL-FAST] Daily reward insert returned ${inserted.length} rows`);
      }
      continue;
    }

    // ── Server-side cooldown guard: reject if < 20h since last claim ──
    if (stats.lastLoginRewardAt !== null) {
      const lastClaimTime = parseCanonicalIsoTimestampMs(
        stats.lastLoginRewardAt,
        'user_stats.last_login_reward_at',
      );
      const hoursSinceLastClaim = (Date.now() - lastClaimTime) / (1000 * 60 * 60);
      if (hoursSinceLastClaim < DAILY_REWARD_COOLDOWN_HOURS) {
        return c.json({ claimed: false, reason: 'cooldown' });
      }
    }

    // ── OCC update: +N normalDraws + 1 goldenDraw, set lastLoginRewardAt, bump version ──
    const dailyDraws = rollNormalDraws();
    const updated = await db
      .update(userStats)
      .set({
        normalDraws: sql`${userStats.normalDraws} + ${dailyDraws}`,
        goldenDraws: sql`${userStats.goldenDraws} + 1`,
        lastLoginRewardAt: new Date().toISOString(),
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      continue;
    }

    return c.json({ claimed: true, normalDrawsAdded: dailyDraws, goldenDrawsAdded: 1 });
  }

  return c.json({ success: false, reason: 'CONFLICT' }, 409);
});

/** POST /api/gacha/exchange -- exchange shards for a specific item */
gachaRoutes.post('/gacha/exchange', requireAuth, jsonBody(shardExchangeSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const { rewardId, idempotencyKey } = c.req.valid('json');
  log.info('exchange request', { userId, rewardId });

  const cached = await readGachaReplay(c.env.DB, {
    userId,
    key: idempotencyKey,
    operation: 'exchange',
    responseSchema: exchangeResponseSchema,
  });
  if (cached.kind === 'conflict') {
    return c.json({ success: false, reason: 'CONFLICT' }, 409);
  }
  if (cached.kind === 'replay') {
    log.info('exchange idempotent hit', { userId, idempotencyKey });
    return c.json(cached.response);
  }

  // 1. Validate the item exists in the reward pool
  const rewardItem = REWARD_POOL_BY_ID.get(rewardId);
  if (!rewardItem) {
    log.warn('invalid reward id', { userId, rewardId });
    return c.json({ success: false, reason: 'INVALID_ITEM' }, 400);
  }

  const cost = SHARD_COSTS[rewardItem.rarity];

  for (let attempt = 0; attempt < MAX_GACHA_OCC_ATTEMPTS; attempt++) {
    // 2. Read current stats
    const stats = await db
      .select({
        shards: userStats.shards,
        unlockedItems: userStats.unlockedItems,
        version: userStats.version,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();

    if (!stats) {
      log.warn('no stats row', { userId });
      return c.json({ success: false, reason: 'NO_STATS' }, 400);
    }

    // 3. Check sufficient shards
    if (stats.shards < cost) {
      log.warn('insufficient shards', { userId, shards: stats.shards, cost });
      return c.json({ success: false, reason: 'INSUFFICIENT_SHARDS' }, 400);
    }

    // 4. Check not already owned
    const unlockedIds = parseUnlockedRewardIds(stats.unlockedItems);
    if (unlockedIds.includes(rewardId)) {
      log.warn('already owned', { userId, rewardId });
      return c.json({ success: false, reason: 'ALREADY_OWNED' }, 400);
    }

    const updatedItems = JSON.stringify([...unlockedIds, rewardId]);
    const response: ExchangeResponse = {
      rewardId,
      rewardType: rewardItem.type,
      rarity: rewardItem.rarity,
      cost,
      remainingShards: stats.shards - cost,
    };
    const committed = await commitGachaExchange(c.env.DB, {
      userId,
      key: idempotencyKey,
      expectedVersion: stats.version,
      cost,
      unlockedItemsJson: updatedItems,
      response,
      responseSchema: exchangeResponseSchema,
    });
    if (committed.kind === 'conflict') {
      return c.json({ success: false, reason: 'CONFLICT' }, 409);
    }
    if (committed.kind === 'miss') continue;

    log.info('exchange success', {
      userId,
      rewardId: committed.response.rewardId,
      cost: committed.response.cost,
      remainingShards: committed.response.remainingShards,
    });
    return c.json(committed.response);
  }

  log.error('OCC retries exhausted', { userId, rewardId });
  return c.json({ success: false, reason: 'CONFLICT' }, 409);
});
