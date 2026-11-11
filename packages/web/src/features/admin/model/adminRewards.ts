/** Admin ticket grant contracts; positive additive grants only, with exact response decoding. */
import * as z from 'zod/mini';

const MAX_ADMIN_REWARD_COUNT = 10000;
export const adminRewardInputSchema = z.strictObject({
  id: z.uuid(),
  drawType: z.enum(['normal', 'golden']),
  count: z.int().check(z.minimum(1), z.maximum(MAX_ADMIN_REWARD_COUNT)),
  reason: z.string().check(z.trim(), z.minLength(1), z.maxLength(200)),
});

export const adminRewardGrantSchema = z.extend(adminRewardInputSchema, {
  userId: z.string().check(z.minLength(1)),
  balanceBefore: z.int().check(z.nonnegative()),
  balanceAfter: z.int().check(z.nonnegative()),
  createdAt: z.string(),
});

export const adminUserRewardsSchema = z.strictObject({
  normalDraws: z.int().check(z.nonnegative()),
  goldenDraws: z.int().check(z.nonnegative()),
  grants: z.array(adminRewardGrantSchema),
});

export type AdminRewardInput = z.output<typeof adminRewardInputSchema>;
export type AdminRewardGrant = z.output<typeof adminRewardGrantSchema>;
