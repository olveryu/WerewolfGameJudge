import { useQuery } from '@tanstack/react-query';

import { undercoverPublicStatsOptions } from '@/games/undercover/services/undercoverStats';

export function useUndercoverPublicStats(userId: string) {
  return useQuery({
    ...undercoverPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
