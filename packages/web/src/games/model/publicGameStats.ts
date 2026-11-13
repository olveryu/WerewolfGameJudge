import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/http/client';

export function publicGameStatsOptions<TGameType extends GameType, TStats>(
  gameType: TGameType,
  userId: string,
  decode: (value: unknown) => TStats,
) {
  return queryOptions({
    queryKey: ['games', gameType, 'users', userId, 'stats'] as const,
    queryFn: () =>
      apiClient.json({
        method: 'GET',
        path: `/api/games/${gameType}/users/${encodeURIComponent(userId)}/stats`,
        auth: 'required',
        idempotent: true,
        decode,
      }),
    staleTime: 0,
  });
}
