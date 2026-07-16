/** Zod schemas for /api/gacha/* endpoints */

import { z } from 'zod';

/** POST /api/gacha/draw — body */
export const gachaDrawSchema = z.strictObject({
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().uuid(),
});

/** POST /api/gacha/daily-reward — body */
export const dailyRewardSchema = z.strictObject({});

/** POST /api/gacha/exchange — body */
export const shardExchangeSchema = z.strictObject({
  rewardId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});
