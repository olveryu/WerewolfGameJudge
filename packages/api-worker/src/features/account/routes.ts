/**
 * Account growth and reward-status routes.
 *
 * GET /api/user/stats: returns current user XP, level, games played.
 * GET /api/user/:userId/profile: returns specified user's public profile.
 * GET /api/user/:userId/unlocks: returns specified user's unlocked items list.
 * Logged-in users only.
 *
 * @throws 401 — requireAuth failed
 * @throws 404 — target user not found
 */

import { getLevelTitle } from '@game-judge/game-engine/product/growth';
import { parseUnlockedRewardIds } from '@game-judge/game-engine/product/rewards';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { createDb } from '../../db';
import type { AppEnv } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import {
  acknowledgeUserEvents,
  readUserEvents,
  USER_INBOX_MAX_BATCH,
} from '../../platform/userInbox/inbox';
import { requireAuth, requireNonAnonymous } from '../auth/tokenAuth';
import { users, userStats } from './dbSchema';

const inboxLimitSchema = z.coerce.number().int().min(1).max(USER_INBOX_MAX_BATCH);
const inboxAckSchema = z.strictObject({
  eventIds: z.array(z.string().min(1)).min(1).max(USER_INBOX_MAX_BATCH),
});

/** User stats/profile routes. */
export const accountRoutes = new Hono<AppEnv>();

/** GET /api/user/events?limit=N — oldest unacknowledged inbox events for the caller. */
accountRoutes.get('/user/events', requireAuth, async (c) => {
  const parsedLimit = inboxLimitSchema.safeParse(c.req.query('limit') ?? USER_INBOX_MAX_BATCH);
  if (!parsedLimit.success) {
    return c.json({ success: false as const, reason: 'INVALID_LIMIT' }, 400);
  }
  c.header('Cache-Control', 'no-store');
  return c.json(await readUserEvents(c.env.DB, c.var.userId, parsedLimit.data));
});

/** POST /api/user/events/ack — delete the caller's own events after they were consumed. */
accountRoutes.post('/user/events/ack', requireAuth, jsonBody(inboxAckSchema), async (c) => {
  const { eventIds } = c.req.valid('json');
  return c.json({ acknowledged: await acknowledgeUserEvents(c.env.DB, c.var.userId, eventIds) });
});

/** GET /api/user/:userId/profile — view another player's public profile */
accountRoutes.get('/user/:userId/profile', requireAuth, async (c) => {
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
accountRoutes.get('/user/:userId/unlocks', requireAuth, async (c) => {
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

/** GET /api/user/stats — current user's growth data (non-anonymous only) */
accountRoutes.get('/user/stats', requireAuth, requireNonAnonymous, async (c) => {
  const db = createDb(c.env.DB);
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
