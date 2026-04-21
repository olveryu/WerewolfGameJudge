/**
 * handlers/gachaHandlers — 扭蛋/抽奖 Hono routes
 *
 * GET  /api/gacha/status — 查询当前抽奖券数量 + pity 计数
 * POST /api/gacha/draw   — 执行抽奖（扣券 + roll + 解锁 + 记录历史）
 *
 * 事务性：draw 操作在单次 D1 batch 中完成，保证原子性。
 */

import type { DrawType, Rarity } from '@werewolf/game-engine/growth/gachaProbability';
import { rollRarity, selectReward } from '@werewolf/game-engine/growth/gachaProbability';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { drawHistory, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { dailyRewardSchema, gachaDrawSchema } from '../schemas/gacha';

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
  rewardType: string;
  rewardId: string;
  isNew: boolean;
  isPityTriggered: boolean;
}

/** Max OCC retries for concurrent draw conflict */
const MAX_DRAW_RETRIES = 3;

/** POST /api/gacha/draw */
gachaRoutes.post('/gacha/draw', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;

  const body = await c.req.json();
  const parsed = gachaDrawSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.issues }, 400);
  }

  const { drawType, count } = parsed.data;

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
      return c.json({ error: 'no_stats', message: '请先完成一局游戏' }, 400);
    }

    // 2. Check sufficient tickets
    const availableTickets = drawType === 'golden' ? stats.goldenDraws : stats.normalDraws;
    if (availableTickets < count) {
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
      createdAt: string;
    }> = [];

    const now = new Date().toISOString();

    // 4. Execute draws
    for (let i = 0; i < count; i++) {
      const randomValue = cryptoRandomPercent();
      const { rarity, pityReset } = rollRarity(drawType, currentPity, randomValue);

      const reward = selectReward(rarity, unlockedSet, cryptoRandomInt);

      if (reward) {
        const isNew = !unlockedSet.has(reward.id);
        if (isNew) unlockedSet.add(reward.id);

        results.push({
          rarity,
          rewardType: reward.type,
          rewardId: reward.id,
          isNew,
          isPityTriggered: pityReset,
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
          createdAt: now,
        });
      } else {
        // All items collected
        break;
      }

      currentPity = pityReset ? 0 : currentPity + 1;
    }

    if (results.length === 0) {
      return c.json({ error: 'all_collected', message: '已收集全部物品' }, 400);
    }

    // 5. OCC write: deduct tickets, update pity, update unlocked items, bump version
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
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      // Version conflict — another request modified stats concurrently, retry
      continue;
    }

    // 6. Insert draw history records (no conflict risk — unique IDs)
    if (historyEntries.length > 0) {
      await db.insert(drawHistory).values(historyEntries);
    }

    // 7. Return results
    return c.json({
      results,
      remaining: {
        normalDraws: drawType === 'normal' ? availableTickets - actualCount : stats.normalDraws,
        goldenDraws: drawType === 'golden' ? availableTickets - actualCount : stats.goldenDraws,
      },
    });
  }

  // All retries exhausted — concurrent conflict persisted
  return c.json({ error: 'conflict', message: '请求冲突，请重试' }, 409);
});

/** POST /api/gacha/daily-reward — 每日登录奖励：领取 1 次普通抽 */
gachaRoutes.post('/gacha/daily-reward', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;

  const body = await c.req.json();
  const parsed = dailyRewardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', details: parsed.error.issues }, 400);
  }

  const { localDate: _localDate } = parsed.data;

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
          normalDraws: 1,
          lastLoginRewardAt: claimedAt,
          updatedAt: claimedAt,
        })
        .onConflictDoUpdate({
          target: userStats.userId,
          set: {
            normalDraws: sql`${userStats.normalDraws} + 1`,
            lastLoginRewardAt: claimedAt,
            version: sql`${userStats.version} + 1`,
            updatedAt: sql`datetime('now')`,
          },
        });

      return c.json({ claimed: true, normalDrawsAdded: 1 });
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
        normalDraws: sql`${userStats.normalDraws} + 1`,
        lastLoginRewardAt: new Date().toISOString(),
        version: sql`${userStats.version} + 1`,
        updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(userStats.userId, userId), eq(userStats.version, stats.version)))
      .returning({ version: userStats.version });

    if (updated.length === 0) {
      continue;
    }

    return c.json({ claimed: true, normalDrawsAdded: 1 });
  }

  return c.json({ error: 'conflict', message: '请求冲突，请重试' }, 409);
});
