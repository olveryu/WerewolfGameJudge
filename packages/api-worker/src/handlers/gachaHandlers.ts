/**
 * handlers/gachaHandlers — 扭蛋/抽奖 Hono routes
 *
 * GET  /api/gacha/status   — 查询当前抽奖券数量 + pity 计数 + 碎片余额
 * POST /api/gacha/draw     — 执行抽奖（扣券 + roll + 解锁/碎片 + 记录历史）
 * POST /api/gacha/exchange — 碎片兑换指定物品
 *
 * 事务性：draw/exchange 操作使用 OCC，保证原子性。
 */

import type { DrawType, Rarity } from '@werewolf/game-engine/growth/gachaProbability';
import { rollRarity, selectReward } from '@werewolf/game-engine/growth/gachaProbability';
import type { RewardType } from '@werewolf/game-engine/growth/rewardCatalog';
import { REWARD_POOL_BY_ID, SHARD_COSTS } from '@werewolf/game-engine/growth/rewardCatalog';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { drawHistory, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { dailyRewardSchema, gachaDrawSchema, shardExchangeSchema } from '../schemas/gacha';
import { jsonBody } from './shared';

const log = createLogger('gacha');

export const gachaRoutes = new Hono<AppEnv>();

/** Minimum hours between daily reward claims (server-side cooldown guard) */
const DAILY_REWARD_COOLDOWN_HOURS = 20;

/** 每日登录奖励的普通抽奖券数 */
const NORMAL_DRAWS_PER_DAILY_LOGIN = 2;

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
      lastLoginRewardAt: userStats.lastLoginRewardAt,
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
      lastLoginRewardAt: null,
    });
  }

  const unlockedItems: string[] = JSON.parse(stats.unlockedItems) as string[];

  return c.json({
    normalDraws: stats.normalDraws,
    goldenDraws: stats.goldenDraws,
    normalPity: stats.normalPity,
    goldenPity: stats.goldenPity,
    shards: stats.shards,
    unlockedCount: unlockedItems.length,
    lastLoginRewardAt: stats.lastLoginRewardAt,
  });
});

/** crypto-safe random float in [0, 100) */
function cryptoRandomPercent(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] / 0x100000000) * 100;
}

/** crypto-safe random int in [0, max) */
function cryptoRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

interface DrawResult {
  rarity: Rarity;
  rewardType: RewardType;
  rewardId: string;
  isNew: boolean;
  isPityTriggered: boolean;
  isDuplicate: boolean;
  shardsAwarded: number;
}

/** Max OCC retries for concurrent draw conflict */
const MAX_DRAW_RETRIES = 3;

/** POST /api/gacha/draw */
gachaRoutes.post('/gacha/draw', requireAuth, jsonBody(gachaDrawSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const { drawType, count } = c.req.valid('json');
  log.info('draw request', { userId, drawType, count });

  for (let attempt = 0; attempt < MAX_DRAW_RETRIES; attempt++) {
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
      return c.json({ error: 'no_stats', message: '请先完成一局游戏' }, 400);
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
      return c.json({ error: 'insufficient_draws', message: '抽奖券不足' }, 400);
    }

    // 3. Parse existing unlocked items
    const unlockedIds: string[] = JSON.parse(stats.unlockedItems) as string[];
    const unlockedSet = new Set(unlockedIds);

    let currentPity = drawType === 'golden' ? stats.goldenPity : stats.normalPity;
    const results: DrawResult[] = [];
    const historyEntries: Array<{
      id: string;
      userId: string;
      drawType: DrawType;
      rarity: Rarity;
      rewardType: string;
      rewardId: string;
      pityCount: number;
      isPityTriggered: number;
      isDuplicate: number;
      shardsAwarded: number;
      createdAt: string;
    }> = [];

    let totalShardsAwarded = 0;
    const now = new Date().toISOString();

    // 4. Execute draws
    for (let i = 0; i < count; i++) {
      const randomValue = cryptoRandomPercent();
      const { rarity, pityReset } = rollRarity(drawType, currentPity, randomValue);

      const result = selectReward(rarity, unlockedSet, cryptoRandomInt);

      if (!result) {
        // Pool is empty (should not happen — pool is static), break
        break;
      }

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
        userId,
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

    // 5. OCC write: deduct tickets, update pity, update unlocked items, add shards, bump version
    const actualCount = results.length;
    const updatedItems = JSON.stringify([...unlockedSet]);

    const pityUpdate =
      drawType === 'golden'
        ? { goldenPity: currentPity, goldenDraws: sql`${userStats.goldenDraws} - ${actualCount}` }
        : { normalPity: currentPity, normalDraws: sql`${userStats.normalDraws} - ${actualCount}` };

    const updated = await db
      .update(userStats)
      .set({
        ...pityUpdate,
        unlockedItems: updatedItems,
        shards: sql`${userStats.shards} + ${totalShardsAwarded}`,
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      // Version conflict — another request modified stats concurrently, retry
      continue;
    }

    // 6. Insert draw history records via D1 batch API.
    // Each statement carries only 11 params (one row), avoiding D1's 100-param-per-query limit.
    // Batch is transactional: all-or-nothing.
    if (historyEntries.length > 0) {
      const stmts = historyEntries.map((entry) => db.insert(drawHistory).values(entry));
      await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);
    }

    // 7. Return results
    const rarities: Rarity[] = results.map((r: DrawResult): Rarity => r.rarity);
    log.info('draw success', {
      userId,
      drawType,
      count: results.length,
      rarities,
      totalShardsAwarded,
    });
    return c.json({
      results,
      totalShardsAwarded,
      remaining: {
        normalDraws: drawType === 'normal' ? availableTickets - actualCount : stats.normalDraws,
        goldenDraws: drawType === 'golden' ? availableTickets - actualCount : stats.goldenDraws,
      },
    });
  }

  // All retries exhausted — concurrent conflict persisted
  log.error('OCC retries exhausted', { userId, drawType, count });
  return c.json({ error: 'conflict', message: '请求冲突，请重试' }, 409);
});

/** POST /api/gacha/daily-reward — 每日登录奖励：领取普通抽 */
gachaRoutes.post('/gacha/daily-reward', requireAuth, jsonBody(dailyRewardSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const { localDate: _localDate } = c.req.valid('json');

  for (let attempt = 0; attempt < MAX_DRAW_RETRIES; attempt++) {
    const stats = await db
      .select({
        lastLoginRewardAt: userStats.lastLoginRewardAt,
        version: userStats.version,
        updatedAt: userStats.updatedAt,
      })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();

    // ── No stats row yet → create one with the daily reward ──
    if (!stats) {
      const claimedAt = new Date().toISOString();
      await db
        .insert(userStats)
        .values({
          userId,
          normalDraws: NORMAL_DRAWS_PER_DAILY_LOGIN,
          lastLoginRewardAt: claimedAt,
          updatedAt: claimedAt,
        })
        .onConflictDoUpdate({
          target: userStats.userId,
          set: {
            normalDraws: sql`${userStats.normalDraws} + ${NORMAL_DRAWS_PER_DAILY_LOGIN}`,
            lastLoginRewardAt: claimedAt,
            version: sql`${userStats.version} + 1`,
            updatedAt: sql`datetime('now')`,
          },
        });

      return c.json({ claimed: true, normalDrawsAdded: NORMAL_DRAWS_PER_DAILY_LOGIN });
    }

    // ── Server-side cooldown guard: reject if < 20h since last claim ──
    if (stats.lastLoginRewardAt) {
      // lastLoginRewardAt is ISO datetime (or legacy YYYY-MM-DD → parsed as midnight UTC)
      const lastClaimTime = new Date(stats.lastLoginRewardAt).getTime();
      const hoursSinceLastClaim = (Date.now() - lastClaimTime) / (1000 * 60 * 60);
      if (hoursSinceLastClaim < DAILY_REWARD_COOLDOWN_HOURS) {
        return c.json({ claimed: false, reason: 'cooldown' });
      }
    }

    // ── OCC update: +1 normalDraws, set lastLoginRewardAt, bump version ──
    const updated = await db
      .update(userStats)
      .set({
        normalDraws: sql`${userStats.normalDraws} + ${NORMAL_DRAWS_PER_DAILY_LOGIN}`,
        lastLoginRewardAt: new Date().toISOString(),
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      continue;
    }

    return c.json({ claimed: true, normalDrawsAdded: NORMAL_DRAWS_PER_DAILY_LOGIN });
  }

  return c.json({ error: 'conflict', message: '请求冲突，请重试' }, 409);
});

/** POST /api/gacha/exchange — 碎片兑换指定物品 */
gachaRoutes.post('/gacha/exchange', requireAuth, jsonBody(shardExchangeSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const { rewardId } = c.req.valid('json');
  log.info('exchange request', { userId, rewardId });

  // 1. Validate the item exists in the reward pool
  const rewardItem = REWARD_POOL_BY_ID.get(rewardId);
  if (!rewardItem) {
    log.warn('invalid reward id', { userId, rewardId });
    return c.json({ error: 'invalid_item', message: '物品不存在' }, 400);
  }

  const cost = SHARD_COSTS[rewardItem.rarity];

  for (let attempt = 0; attempt < MAX_DRAW_RETRIES; attempt++) {
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
      return c.json({ error: 'no_stats', message: '请先完成一局游戏' }, 400);
    }

    // 3. Check sufficient shards
    if (stats.shards < cost) {
      log.warn('insufficient shards', { userId, shards: stats.shards, cost });
      return c.json({ error: 'insufficient_shards', message: '碎片不足' }, 400);
    }

    // 4. Check not already owned
    const unlockedIds: string[] = JSON.parse(stats.unlockedItems) as string[];
    if (unlockedIds.includes(rewardId)) {
      log.warn('already owned', { userId, rewardId });
      return c.json({ error: 'already_owned', message: '已拥有该物品' }, 400);
    }

    // 5. OCC write: deduct shards, add to unlocked, bump version
    const updatedItems = JSON.stringify([...unlockedIds, rewardId]);

    const updated = await db
      .update(userStats)
      .set({
        shards: sql`${userStats.shards} - ${cost}`,
        unlockedItems: updatedItems,
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      continue;
    }

    log.info('exchange success', { userId, rewardId, cost, remainingShards: stats.shards - cost });
    return c.json({
      rewardId,
      rewardType: rewardItem.type,
      rarity: rewardItem.rarity,
      cost,
      remainingShards: stats.shards - cost,
    });
  }

  log.error('OCC retries exhausted', { userId, rewardId });
  return c.json({ error: 'conflict', message: '请求冲突，请重试' }, 409);
});
