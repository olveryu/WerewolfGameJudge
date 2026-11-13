import { useQuery } from '@tanstack/react-query';

import { avalonPublicStatsOptions } from '@/games/avalon/services/avalonStats';

export function useAvalonPublicStats(userId: string) {
  return useQuery({
    ...avalonPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
