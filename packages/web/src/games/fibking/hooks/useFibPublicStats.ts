import { useQuery } from '@tanstack/react-query';

import { fibPublicStatsOptions } from '@/games/fibking/services/fibStats';

export function useFibPublicStats(userId: string) {
  return useQuery({
    ...fibPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
