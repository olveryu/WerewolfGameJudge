/** Zod schemas for /api/gacha/* endpoints */

import { z } from 'zod';

/** POST /api/gacha/draw — body */
export const gachaDrawSchema = z.object({
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(10).default(1),
});

/** POST /api/gacha/daily-reward — body */
export const dailyRewardSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** POST /api/gacha/exchange — body */
export const shardExchangeSchema = z.object({
  rewardId: z.string().min(1),
});
