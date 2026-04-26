/**
 * handlers/statsHandlers — 用户成长数据 Hono routes
 *
 * GET /api/user/stats：返回当前用户 XP、等级、局数。
 * GET /api/user/:userId/profile：返回指定用户的公开资料。
 * GET /api/user/:userId/unlocks：返回指定用户的已解锁物品列表。
 * 仅限已登录用户。
 */

import { getLevelTitle } from '@werewolf/game-engine/growth/level';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { users, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

export const statsRoutes = new Hono<AppEnv>();

/** GET /api/user/:userId/profile — 查看其他玩家公开资料 */
statsRoutes.get('/user/:userId/profile', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const targetUserId = c.req.param('userId');

  const [userRow, statsRow] = await Promise.all([
    db
      .select({
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        customAvatarUrl: users.customAvatarUrl,
        avatarFrame: users.avatarFrame,
        equippedFlair: users.equippedFlair,
        equippedNameStyle: users.equippedNameStyle,
        equippedEffect: users.equippedEffect,
        equippedSeatAnimation: users.equippedSeatAnimation,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .get(),
    db
      .select({
        xp: userStats.xp,
        level: userStats.level,
        gamesPlayed: userStats.gamesPlayed,
        unlockedItems: userStats.unlockedItems,
      })
      .from(userStats)
      .where(eq(userStats.userId, targetUserId))
      .get(),
  ]);

  if (!userRow) return c.json({ error: 'user not found' }, 404);

  const unlockedItems: string[] = statsRow?.unlockedItems
    ? (JSON.parse(statsRow.unlockedItems) as string[])
    : [];

  const level = statsRow?.level ?? 0;

  return c.json(
    {
      displayName: userRow.displayName ?? '',
      avatarUrl: userRow.customAvatarUrl ?? userRow.avatarUrl ?? undefined,
      avatarFrame: userRow.avatarFrame ?? undefined,
      seatFlair: userRow.equippedFlair ?? undefined,
      nameStyle: userRow.equippedNameStyle ?? undefined,
      roleRevealEffect: userRow.equippedEffect ?? undefined,
      seatAnimation: userRow.equippedSeatAnimation ?? undefined,
      level,
      title: getLevelTitle(level),
      xp: statsRow?.xp ?? 0,
      gamesPlayed: statsRow?.gamesPlayed ?? 0,
      unlockedItemCount: unlockedItems.length,
    },
    200,
  );
});

/** GET /api/user/:userId/unlocks — 查看其他玩家已解锁物品列表 */
statsRoutes.get('/user/:userId/unlocks', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const targetUserId = c.req.param('userId');

  const statsRow = await db
    .select({ unlockedItems: userStats.unlockedItems })
    .from(userStats)
    .where(eq(userStats.userId, targetUserId))
    .get();

  const unlockedItems: string[] = statsRow?.unlockedItems
    ? (JSON.parse(statsRow.unlockedItems) as string[])
    : [];

  return c.json({ unlockedItems }, 200);
});

/** GET /api/user/stats — 当前用户成长数据 */
statsRoutes.get('/user/stats', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const payload = c.var.jwtPayload;
  if (payload.anon) return c.json({ error: 'anonymous users not supported' }, 403);

  const userId = c.var.userId;

  const statsRow = await db
    .select({
      xp: userStats.xp,
      level: userStats.level,
      gamesPlayed: userStats.gamesPlayed,
      unlockedItems: userStats.unlockedItems,
    })
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .get();

  const unlockedItems: string[] = statsRow?.unlockedItems
    ? (JSON.parse(statsRow.unlockedItems) as string[])
    : [];

  return c.json(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.gamesPlayed ?? 0,
      unlockedItems,
    },
    200,
  );
});
