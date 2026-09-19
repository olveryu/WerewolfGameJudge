/** Admin ticket grant contracts; positive additive grants only, with exact response decoding. */
import { z } from 'zod';

const MAX_ADMIN_REWARD_COUNT = 10000;
export const adminRewardInputSchema = z.strictObject({
  id: z.uuid(),
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(MAX_ADMIN_REWARD_COUNT),
  reason: z.string().trim().min(1).max(200),
});

export const adminRewardGrantSchema = adminRewardInputSchema.extend({
  userId: z.string().min(1),
  balanceBefore: z.number().int().nonnegative(),
  balanceAfter: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export const adminUserRewardsSchema = z.strictObject({
  normalDraws: z.number().int().nonnegative(),
  goldenDraws: z.number().int().nonnegative(),
  grants: adminRewardGrantSchema.array(),
});

export type AdminRewardInput = z.output<typeof adminRewardInputSchema>;
export type AdminRewardGrant = z.output<typeof adminRewardGrantSchema>;
