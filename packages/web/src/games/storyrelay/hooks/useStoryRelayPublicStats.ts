import { useQuery } from '@tanstack/react-query';

import { storyRelayPublicStatsOptions } from '@/games/storyrelay/services/storyRelayStats';

export function useStoryRelayPublicStats(userId: string) {
  return useQuery({
    ...storyRelayPublicStatsOptions(userId),
    enabled: userId.length > 0,
  });
}
