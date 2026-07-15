/**
 * handlers/statsHandlers — User growth data Hono routes
 *
 * GET /api/user/stats: returns current user XP, level, games played.
 * GET /api/user/:userId/profile: returns specified user's public profile.
 * GET /api/user/:userId/unlocks: returns specified user's unlocked items list.
 * GET /api/games/:gameType/users/:userId/stats: delegates public game statistics to its module.
 * Logged-in users only.
 *
 * @throws 401 — requireAuth failed
 * @throws 404 — target user not found
 */

import { isGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { getLevelTitle } from '@game-judge/game-engine/product/growth';
import { parseUnlockedRewardIds } from '@game-judge/game-engine/product/rewards';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { users, userStats } from '../db/applicationSchema';
import type { AppEnv } from '../env';
import { WORKER_GAME_CATALOG } from '../games/catalog';
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

  const unlockedItems = statsRow?.unlockedItems
    ? parseUnlockedRewardIds(statsRow.unlockedItems)
    : [];

  const level = statsRow?.level ?? 0;

  return c.json(
    {
      displayName: userRow.displayName ?? '',
      avatarUrl: userRow.avatarUrl ?? undefined,
      avatarFrame: userRow.avatarFrame ?? undefined,
      seatFlair: userRow.equippedFlair ?? undefined,
      nameStyle: userRow.equippedNameStyle ?? undefined,
      revealEffect: userRow.equippedEffect ?? undefined,
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

  const unlockedItems = statsRow?.unlockedItems
    ? parseUnlockedRewardIds(statsRow.unlockedItems)
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

  const unlockedItems = statsRow?.unlockedItems
    ? parseUnlockedRewardIds(statsRow.unlockedItems)
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

/** GET /api/games/:gameType/users/:userId/stats — public statistics owned by a game module. */
statsRoutes.get('/games/:gameType/users/:userId/stats', requireAuth, async (c) => {
  const gameType = c.req.param('gameType');
  if (!isGameType(gameType)) {
    return c.json({ success: false, reason: 'GAME_TYPE_NOT_FOUND' }, 404);
  }

  const stats = await WORKER_GAME_CATALOG[gameType].getPublicUserStats(
    c.req.param('userId'),
    c.env,
  );
  return c.json(stats, 200);
});
