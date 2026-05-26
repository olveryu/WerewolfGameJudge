/**
 * handlers/statsHandlers — User growth data Hono routes
 *
 * GET /api/user/stats: returns current user XP, level, games played.
 * GET /api/user/:userId/profile: returns specified user's public profile.
 * GET /api/user/:userId/unlocks: returns specified user's unlocked items list.
 * Logged-in users only.
 *
 * @throws 401 — requireAuth failed
 * @throws 404 — target user not found
 */

import { getLevelTitle } from '@werewolf/game-engine/growth/level';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { users, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

/** User stats/profile routes. */
export const statsRoutes = new Hono<AppEnv>();

/** GET /api/user/:userId/profile — view another player's public profile */
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

  if (!userRow) return c.json({ success: false, reason: 'USER_NOT_FOUND' }, 404);

  const unlockedItems: string[] = statsRow?.unlockedItems
    ? (JSON.parse(statsRow.unlockedItems) as string[])
    : [];

  const level = statsRow?.level ?? 0;

  return c.json(
    {
      displayName: userRow.displayName ?? '',
      avatarUrl: userRow.avatarUrl ?? undefined,
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

/** GET /api/user/:userId/unlocks — view another player's unlocked items list */
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

/** GET /api/user/stats — current user's growth data */
statsRoutes.get('/user/stats', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const payload = c.var.jwtPayload;
  if (payload.anon) return c.json({ success: false, reason: 'ANONYMOUS_NOT_SUPPORTED' }, 403);

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
