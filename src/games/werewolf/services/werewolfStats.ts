/** Werewolf public-statistics HTTP contract and cache key. */

import { queryOptions } from '@tanstack/react-query';
import {
  parseWerewolfPublicStats,
  type WerewolfPublicStats,
} from '@werewolf/game-engine/games/werewolf/public';

import { cfGet } from '@/services/cloudflare/cfFetch';

const WEREWOLF_STATS_STALE_TIME_MS = 5 * 60_000;

export async function fetchWerewolfPublicStats(userId: string): Promise<WerewolfPublicStats> {
  const value = await cfGet<unknown>(
    `/api/games/werewolf/users/${encodeURIComponent(userId)}/stats`,
  );
  return parseWerewolfPublicStats(value);
}

export const werewolfPublicStatsOptions = (userId: string) =>
  queryOptions({
    queryKey: ['games', 'werewolf', 'users', userId, 'stats'] as const,
    queryFn: () => fetchWerewolfPublicStats(userId),
    staleTime: WEREWOLF_STATS_STALE_TIME_MS,
  });
