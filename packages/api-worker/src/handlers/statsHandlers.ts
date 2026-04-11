/**
 * handlers/statsHandlers — 用户成长数据 API
 *
 * GET /api/user/stats：返回 XP、等级、局数、角色收集数、上局月相。
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

  // Fetch stats + collection count + last moon phase in parallel
  const [statsRow, collectionCount, lastGame] = await Promise.all([
    env.DB.prepare(`SELECT xp, level, games_played FROM user_stats WHERE user_id = ?`)
      .bind(userId)
      .first<{ xp: number; level: number; games_played: number }>(),

    env.DB.prepare(`SELECT COUNT(*) as count FROM user_role_collection WHERE user_id = ?`)
      .bind(userId)
      .first<{ count: number }>(),

    env.DB.prepare(
      `SELECT moon_phase, xp_earned FROM game_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(userId)
      .first<{ moon_phase: string; xp_earned: number }>(),
  ]);

  return jsonResponse(
    {
      xp: statsRow?.xp ?? 0,
      level: statsRow?.level ?? 0,
      gamesPlayed: statsRow?.games_played ?? 0,
      rolesCollected: collectionCount?.count ?? 0,
      totalRoles: 43,
      lastMoonPhase: lastGame ? { id: lastGame.moon_phase, xpEarned: lastGame.xp_earned } : null,
    },
    200,
    env,
  );
};

export const handleGetUserCollection: HandlerFn = async (req, env) => {
  const token = extractBearerToken(req);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);
  if (payload.anon) return jsonResponse({ error: 'anonymous users not supported' }, 403, env);

  const userId = payload.sub;

  const { results } = await env.DB.prepare(
    `SELECT role_id, first_played_at FROM user_role_collection WHERE user_id = ? ORDER BY first_played_at ASC`,
  )
    .bind(userId)
    .all<{ role_id: string; first_played_at: string }>();

  return jsonResponse(
    { roles: results.map((r) => ({ roleId: r.role_id, firstPlayedAt: r.first_played_at })) },
    200,
    env,
  );
};
