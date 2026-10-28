/**
 * accountApi — client API for user growth data and public profiles
 *
 * Read-only queries: fetch user XP/level/games played, and view other players' public profiles.
 */

import { ROLE_REVEAL_EFFECT_IDS } from '@game-judge/game-engine/product/rewards';
import { z } from 'zod';

import { apiClient } from '@/platform/http/client';
import { statsLog } from '@/utils/logger';

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const unlockedItemsSchema = z.array(z.string().min(1));
const equippedRevealEffectSchema = z.enum(['random', ...ROLE_REVEAL_EFFECT_IDS]);

const userStatsSchema = z.strictObject({
  xp: nonnegativeIntegerSchema,
  level: nonnegativeIntegerSchema,
  gamesPlayed: nonnegativeIntegerSchema,
  unlockedItems: unlockedItemsSchema,
});

const userPublicProfileSchema = z.strictObject({
  displayName: z.string(),
  avatarUrl: z.string().min(1).optional(),
  avatarFrame: z.string().min(1).optional(),
  seatFlair: z.string().min(1).optional(),
  nameStyle: z.string().min(1).optional(),
  revealEffect: equippedRevealEffectSchema.optional(),
  seatAnimation: z.string().min(1).optional(),
  level: nonnegativeIntegerSchema,
  title: z.string().min(1),
  xp: nonnegativeIntegerSchema,
  gamesPlayed: nonnegativeIntegerSchema,
  unlockedItemCount: nonnegativeIntegerSchema,
});

const userUnlocksSchema = z.strictObject({ unlockedItems: unlockedItemsSchema });

export type UserStats = z.infer<typeof userStatsSchema>;
export type UserPublicProfile = z.infer<typeof userPublicProfileSchema>;

/** Fetches the current user's growth data. */
export async function fetchUserStats(signal?: AbortSignal): Promise<UserStats> {
  statsLog.debug('Fetching user stats');
  return apiClient.json({
    method: 'GET',
    path: '/api/user/stats',
    auth: 'required',
    idempotent: true,
    decode: (value) => userStatsSchema.parse(value),
    signal,
  });
}

/** Fetches the public profile of a specific user. */
export async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  statsLog.debug('Fetching profile', { userId });
  return apiClient.json({
    method: 'GET',
    path: `/api/user/${encodeURIComponent(userId)}/profile`,
    auth: 'required',
    idempotent: true,
    decode: (value) => userPublicProfileSchema.parse(value),
  });
}

/** Fetches the list of unlocked items for a specific user. */
export async function fetchUserUnlocks(
  userId: string,
): Promise<{ unlockedItems: readonly string[] }> {
  statsLog.debug('Fetching unlocks', { userId });
  return apiClient.json({
    method: 'GET',
    path: `/api/user/${encodeURIComponent(userId)}/unlocks`,
    auth: 'required',
    idempotent: true,
    decode: (value) => userUnlocksSchema.parse(value),
  });
}
