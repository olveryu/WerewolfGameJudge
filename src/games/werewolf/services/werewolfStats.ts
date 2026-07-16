/** Werewolf public-statistics HTTP contract and cache key. */

import {
  parseWerewolfPublicStats,
  type WerewolfPublicStats,
} from '@game-judge/game-engine/games/werewolf/public';
import { queryOptions } from '@tanstack/react-query';

import { cfGet } from '@/services/cloudflare/cfFetch';

const WEREWOLF_STATS_STALE_TIME_MS = 5 * 60_000;

export async function fetchWerewolfPublicStats(userId: string): Promise<WerewolfPublicStats> {
  return cfGet(
    `/api/games/werewolf/users/${encodeURIComponent(userId)}/stats`,
    parseWerewolfPublicStats,
  );
}

export const werewolfPublicStatsOptions = (userId: string) =>
  queryOptions({
    queryKey: ['games', 'werewolf', 'users', userId, 'stats'] as const,
    queryFn: () => fetchWerewolfPublicStats(userId),
    staleTime: WEREWOLF_STATS_STALE_TIME_MS,
  });
