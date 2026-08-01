/**
 * accountApi — client API for user growth data and public profiles
 *
 * Read-only queries: fetch user XP/level/games played, and view other players' public profiles.
 * Uses cfGet wrapper (auto-injects token + timeout + error handling).
 */

import { z } from 'zod';

import { cfGet } from '@/services/cloudflare/cfFetch';
import { statsLog } from '@/utils/logger';

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const unlockedItemsSchema = z.array(z.string().min(1));

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
  revealEffect: z.string().min(1).optional(),
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
export async function fetchUserStats(): Promise<UserStats> {
  statsLog.debug('Fetching user stats');
  return cfGet('/api/user/stats', (value) => userStatsSchema.parse(value));
}

/** Fetches the public profile of a specific user. */
export async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  statsLog.debug('Fetching profile', { userId });
  return cfGet(`/api/user/${encodeURIComponent(userId)}/profile`, (value) =>
    userPublicProfileSchema.parse(value),
  );
}

/** Fetches the list of unlocked items for a specific user. */
export async function fetchUserUnlocks(
  userId: string,
): Promise<{ unlockedItems: readonly string[] }> {
  statsLog.debug('Fetching unlocks', { userId });
  return cfGet(`/api/user/${encodeURIComponent(userId)}/unlocks`, (value) =>
    userUnlocksSchema.parse(value),
  );
}
