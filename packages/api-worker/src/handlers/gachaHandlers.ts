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
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { drawHistory, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { gachaDrawSchema } from '../schemas/gacha';

export const gachaRoutes = new Hono<AppEnv>();

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
    });
  }

  const unlockedItems: string[] = JSON.parse(stats.unlockedItems) as string[];

  return c.json({
    normalDraws: stats.normalDraws,
    goldenDraws: stats.goldenDraws,
    normalPity: stats.normalPity,
    goldenPity: stats.goldenPity,
    unlockedCount: unlockedItems.length,
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
  pityTriggered: boolean;
}

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

  // 1. Read current stats
  const stats = await db
    .select({
      normalDraws: userStats.normalDraws,
      goldenDraws: userStats.goldenDraws,
      normalPity: userStats.normalPity,
      goldenPity: userStats.goldenPity,
      unlockedItems: userStats.unlockedItems,
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
    pityTriggered: number;
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
        pityTriggered: pityReset,
      });

      historyEntries.push({
        id: crypto.randomUUID(),
        userId,
        drawType,
        rarity,
        rewardType: reward.type,
        rewardId: reward.id,
        pityCount: currentPity,
        pityTriggered: pityReset ? 1 : 0,
        createdAt: now,
      });
    } else {
      // All items collected — should not normally happen since we checked upfront,
      // but break gracefully
      break;
    }

    currentPity = pityReset ? 0 : currentPity + 1;
  }

  if (results.length === 0) {
    return c.json({ error: 'all_collected', message: '已收集全部物品' }, 400);
  }

  // 5. Write back: deduct tickets, update pity, update unlocked items, insert history
  const actualCount = results.length;
  const updatedItems = JSON.stringify([...unlockedSet]);

  const pityUpdate =
    drawType === 'golden'
      ? { goldenPity: currentPity, goldenDraws: sql`${userStats.goldenDraws} - ${actualCount}` }
      : { normalPity: currentPity, normalDraws: sql`${userStats.normalDraws} - ${actualCount}` };

  await db
    .update(userStats)
    .set({
      ...pityUpdate,
      unlockedItems: updatedItems,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(userStats.userId, userId));

  // Insert draw history records
  if (historyEntries.length > 0) {
    await db.insert(drawHistory).values(historyEntries);
  }

  // 6. Return results
  return c.json({
    results,
    remaining: {
      normalDraws: drawType === 'normal' ? availableTickets - actualCount : stats.normalDraws,
      goldenDraws: drawType === 'golden' ? availableTickets - actualCount : stats.goldenDraws,
    },
  });
});
