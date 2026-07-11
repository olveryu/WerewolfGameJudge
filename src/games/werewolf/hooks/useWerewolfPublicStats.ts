/** Query a user's game-owned Werewolf statistics. */

import { useQuery } from '@tanstack/react-query';

import { werewolfPublicStatsOptions } from '@/games/werewolf/services/werewolfStats';

export function useWerewolfPublicStats(userId: string, options?: { readonly enabled?: boolean }) {
  return useQuery({
    ...werewolfPublicStatsOptions(userId),
    enabled: userId.length > 0 && (options?.enabled ?? true),
  });
}
