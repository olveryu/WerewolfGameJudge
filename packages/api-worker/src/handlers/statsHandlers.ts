/**
 * handlers/statsHandlers — 用户成长数据 API
 *
 * GET /api/user/stats：返回 XP、等级、局数。
 * 仅限已登录非匿名用户。
 */

import { extractBearerToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import type { HandlerFn } from './shared';

export const handleGetUserStats: HandlerFn = async (req, env) => {
  // Auth
  const token = extractBearerToken(req);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);
  if (payload.anon) return jsonResponse({ error: 'anonymous users not supported' }, 403, env);

  const userId = payload.sub;

  const statsRow = await env.DB.prepare(
    `SELECT xp, level, games_played FROM user_stats WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ xp: number; level: number; games_played: number }>();

  return jsonResponse(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
    },
    200,
    env,
  );
};
