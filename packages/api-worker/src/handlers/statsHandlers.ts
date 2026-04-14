/**
 * handlers/statsHandlers — 用户成长数据 Hono routes
 *
 * GET /api/user/stats：返回当前用户 XP、等级、局数。
 * GET /api/user/:userId/profile：返回指定用户的公开资料。
 * GET /api/user/:userId/unlocks：返回指定用户的已解锁物品列表。
 * 仅限已登录用户。
 */

import { getLevelTitle } from '@werewolf/game-engine/growth/level';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

export const statsRoutes = new Hono<AppEnv>();

/** GET /api/user/:userId/profile — 查看其他玩家公开资料 */
statsRoutes.get('/user/:userId/profile', requireAuth, async (c) => {
  const env = c.env;
  const targetUserId = c.req.param('userId');

  // Fetch user display info from users table
  const userRow = await env.DB.prepare(
    `SELECT display_name, avatar_url, custom_avatar_url, avatar_frame, equipped_flair FROM users WHERE id = ?`,
  )
    .bind(targetUserId)
    .first<{
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
      equipped_flair: string | null;
    }>();

  if (!userRow) return c.json({ error: 'user not found' }, 404);

  // Fetch stats from user_stats table
  const statsRow = await env.DB.prepare(
    `SELECT xp, level, games_played, unlocked_items FROM user_stats WHERE user_id = ?`,
  )
    .bind(targetUserId)
    .first<{
      xp: number;
      level: number;
      games_played: number;
      unlocked_items: string;
    }>();

  const unlockedItems: string[] = statsRow?.unlocked_items
    ? (JSON.parse(statsRow.unlocked_items) as string[])
    : [];

  const level = statsRow?.level ?? 0;

  return c.json(
    {
      displayName: userRow.display_name ?? '',
      avatarUrl: userRow.custom_avatar_url ?? userRow.avatar_url ?? undefined,
      avatarFrame: userRow.avatar_frame ?? undefined,
      seatFlair: userRow.equipped_flair ?? undefined,
      level,
      title: getLevelTitle(level),
      xp: statsRow?.xp ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
      unlockedItemCount: unlockedItems.length,
    },
    200,
  );
});

/** GET /api/user/:userId/unlocks — 查看其他玩家已解锁物品列表 */
statsRoutes.get('/user/:userId/unlocks', requireAuth, async (c) => {
  const env = c.env;
  const targetUserId = c.req.param('userId');

  const statsRow = await env.DB.prepare(`SELECT unlocked_items FROM user_stats WHERE user_id = ?`)
    .bind(targetUserId)
    .first<{ unlocked_items: string }>();

  const unlockedItems: string[] = statsRow?.unlocked_items
    ? (JSON.parse(statsRow.unlocked_items) as string[])
    : [];

  return c.json({ unlockedItems }, 200);
});

/** GET /api/user/stats — 当前用户成长数据 */
statsRoutes.get('/user/stats', requireAuth, async (c) => {
  const env = c.env;
  const payload = c.var.jwtPayload;
  if (payload.anon) return c.json({ error: 'anonymous users not supported' }, 403);

  const userId = c.var.userId;

  const statsRow = await env.DB.prepare(
    `SELECT xp, level, games_played, unlocked_items FROM user_stats WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{
      xp: number;
      level: number;
      games_played: number;
      unlocked_items: string;
    }>();

  const unlockedItems: string[] = statsRow?.unlocked_items
    ? (JSON.parse(statsRow.unlocked_items) as string[])
    : [];

  return c.json(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
      unlockedItems,
    },
    200,
  );
});
