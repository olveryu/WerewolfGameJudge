/** Werewolf public-statistics HTTP contract and cache key. */

import {
  parseWerewolfPublicStats,
  type WerewolfPublicStats,
} from '@game-judge/game-engine/games/werewolf/public';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/http/client';

export async function fetchWerewolfPublicStats(userId: string): Promise<WerewolfPublicStats> {
  return apiClient.json({
    method: 'GET',
    path: `/api/games/werewolf/users/${encodeURIComponent(userId)}/stats`,
    auth: 'required',
    idempotent: true,
    decode: parseWerewolfPublicStats,
  });
}

export function getWerewolfStatsRefetchDelay(
  nextVisibilityAt: number | null | undefined,
  nowMs = Date.now(),
): number | false {
  if (nextVisibilityAt === undefined || nextVisibilityAt === null) return false;
  const remainingMs = nextVisibilityAt - nowMs;
  return remainingMs > 0 ? remainingMs : false;
}

export const werewolfPublicStatsOptions = (userId: string) =>
  queryOptions({
    queryKey: ['games', 'werewolf', 'users', userId, 'stats'] as const,
    queryFn: () => fetchWerewolfPublicStats(userId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => getWerewolfStatsRefetchDelay(query.state.data?.nextVisibilityAt),
  });
