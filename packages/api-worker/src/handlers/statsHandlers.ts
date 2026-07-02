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
import { CAMP_ORDER, type CampBucket } from '@werewolf/game-engine/werewolf/models/roles';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import type { Db } from '../db';
import { createDb } from '../db';
import { campSettlements, users, userStats } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

/** User stats/profile routes. */
export const statsRoutes = new Hono<AppEnv>();

/** Hours a finished game stays hidden from the camp distribution (anti-cheat delay, all viewers). */
const PUBLIC_VISIBILITY_DELAY_HOURS = 2;

/** Camp distribution payload: per-bucket counts + visible total. */
interface CampStatsPayload {
  total: number;
  counts: Record<CampBucket, number>;
}

/**
 * Aggregate a user's camp distribution from camp_settlements.
 *
 * Only counts games settled ≥PUBLIC_VISIBILITY_DELAY_HOURS ago — applied uniformly to both the
 * self view and other players' view, so a just-finished game never reveals a player's role.
 */
async function aggregateCampStats(db: Db, userId: string): Promise<CampStatsPayload> {
  const rows = await db
    .select({ camp: campSettlements.camp, n: sql<number>`count(*)` })
    .from(campSettlements)
    .where(
      and(
        eq(campSettlements.userId, userId),
        sql`${campSettlements.settledAt} <= datetime('now', ${`-${PUBLIC_VISIBILITY_DELAY_HOURS} hours`})`,
      ),
    )
    .groupBy(campSettlements.camp);

  const counts = Object.fromEntries(CAMP_ORDER.map((c) => [c, 0])) as Record<CampBucket, number>;
  let total = 0;
  for (const row of rows) {
    if (row.camp in counts) {
      counts[row.camp as CampBucket] = row.n;
      total += row.n;
    }
  }
  return { total, counts };
}

/** GET /api/user/:userId/profile — view another player's public profile */
statsRoutes.get('/user/:userId/profile', requireAuth, async (c) => {
  const db = createDb(c.env.DB);
  const targetUserId = c.req.param('userId');

  const [userRow, statsRow, campStats] = await Promise.all([
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
    // Camp distribution: only games settled ≥2h ago are visible (anti-cheat delay)
    aggregateCampStats(db, targetUserId),
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
      campStats,
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

  // Camp distribution: only games settled ≥2h ago are visible (anti-cheat delay)
  const campStats = await aggregateCampStats(db, userId);

  const unlockedItems: string[] = statsRow?.unlockedItems
    ? (JSON.parse(statsRow.unlockedItems) as string[])
    : [];

  return c.json(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.gamesPlayed ?? 0,
      unlockedItems,
      campStats,
    },
    200,
  );
});
