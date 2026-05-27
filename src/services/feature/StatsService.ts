/**
 * StatsService — client service for user growth data
 *
 * Read-only queries: fetch user XP/level/games played, and view other players' public profiles.
 * Uses cfGet wrapper (auto-injects token + timeout + error handling).
 */

import { cfGet } from '@/services/cloudflare/cfFetch';
import { statsLog } from '@/utils/logger';

export interface UserStats {
  xp: number;
  level: number;
  gamesPlayed: number;
  unlockedItems: readonly string[];
}

export interface UserPublicProfile {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  seatFlair?: string;
  nameStyle?: string;
  roleRevealEffect?: string;
  seatAnimation?: string;
  level: number;
  title: string;
  xp: number;
  gamesPlayed: number;
  unlockedItemCount: number;
}

/** Fetches the current user's growth data. */
export async function fetchUserStats(): Promise<UserStats> {
  statsLog.debug('Fetching user stats');
  return cfGet<UserStats>('/api/user/stats');
}

/** Fetches the public profile of a specific user. */
export async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  statsLog.debug('Fetching profile', { userId });
  return cfGet<UserPublicProfile>(`/api/user/${encodeURIComponent(userId)}/profile`);
}

/** Fetches the list of unlocked items for a specific user. */
export async function fetchUserUnlocks(
  userId: string,
): Promise<{ unlockedItems: readonly string[] }> {
  statsLog.debug('Fetching unlocks', { userId });
  return cfGet<{ unlockedItems: readonly string[] }>(
    `/api/user/${encodeURIComponent(userId)}/unlocks`,
  );
}
