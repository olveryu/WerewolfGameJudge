/**
 * handlers/statsHandlers — 用户成长数据 API
 *
 * GET /api/user/stats：返回当前用户 XP、等级、局数。
 * GET /api/user/:userId/profile：返回指定用户的公开资料。
 * 仅限已登录非匿名用户。
 */

import { extractBearerToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import type { HandlerFn } from './shared';

/** GET /api/user/:userId/profile — 查看其他玩家公开资料 */
export const handleGetUserProfile: HandlerFn = async (req, env) => {
  // Auth: require logged-in user (anonymous allowed — read-only profile view)
  const token = extractBearerToken(req);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  // Extract target userId from URL: /api/user/:userId/profile
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const targetUserId = segments[2]; // ['api', 'user', ':userId', 'profile']
  if (!targetUserId) return jsonResponse({ error: 'userId required' }, 400, env);

  // Fetch user display info from users table
  const userRow = await env.DB.prepare(
    `SELECT display_name, avatar_url, custom_avatar_url, avatar_frame FROM users WHERE id = ?`,
  )
    .bind(targetUserId)
    .first<{
      display_name: string | null;
      avatar_url: string | null;
      custom_avatar_url: string | null;
      avatar_frame: string | null;
    }>();

  if (!userRow) return jsonResponse({ error: 'user not found' }, 404, env);

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

  return jsonResponse(
    {
      displayName: userRow.display_name ?? '',
      avatarUrl: userRow.custom_avatar_url ?? userRow.avatar_url ?? undefined,
      avatarFrame: userRow.avatar_frame ?? undefined,
      level: statsRow?.level ?? 0,
      xp: statsRow?.xp ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
      unlockedItemCount: unlockedItems.length,
    },
    200,
    env,
  );
};

export const handleGetUserStats: HandlerFn = async (req, env) => {
  // Auth
  const token = extractBearerToken(req);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);
  if (payload.anon) return jsonResponse({ error: 'anonymous users not supported' }, 403, env);

  const userId = payload.sub;

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

  return jsonResponse(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
      unlockedItems,
    },
    200,
    env,
  );
};
