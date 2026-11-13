import { useQuery } from '@tanstack/react-query';

import { drawGuessPublicStatsOptions } from '@/games/drawguess/services/drawGuessStats';

export function useDrawGuessPublicStats(userId: string) {
  return useQuery({
    ...drawGuessPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
