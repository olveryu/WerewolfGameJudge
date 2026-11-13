import { useQuery } from '@tanstack/react-query';

import { pictionaryPublicStatsOptions } from '@/games/pictionary/services/pictionaryStats';

export function usePictionaryPublicStats(userId: string) {
  return useQuery({
    ...pictionaryPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
