/** Catalog-dispatched public game statistics routes. */

import { isGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../features/auth/tokenAuth';
import { WORKER_GAME_CATALOG } from './catalog';

export const publicGameStatsRoutes = new Hono<AppEnv>();

publicGameStatsRoutes.get('/games/:gameType/users/:userId/stats', requireAuth, async (c) => {
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
