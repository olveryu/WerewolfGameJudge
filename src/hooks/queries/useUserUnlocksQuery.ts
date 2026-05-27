import { useQuery } from '@tanstack/react-query';

import { userUnlocksOptions } from './queryOptions';

/**
 * useUserUnlocksQuery — list of unlocked items for a given user.
 * For viewing others only; use useUserStatsQuery().data?.unlockedItems to view your own unlocks.
 */
export function useUserUnlocksQuery(userId: string) {
  return useQuery({
    ...userUnlocksOptions(userId),
    enabled: !!userId,
  });
}
