import { useQuery } from '@tanstack/react-query';

import { fetchUserUnlocks } from '@/services/feature/StatsService';

import { queryKeys } from './queryKeys';

/**
 * useUserUnlocksQuery — 查看指定用户的已解锁物品列表。
 * 仅用于查看他人，查看自身解锁请用 useUserStatsQuery().data?.unlockedItems。
 */
export function useUserUnlocksQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.userUnlocks(userId),
    queryFn: () => fetchUserUnlocks(userId).then((r) => r.unlockedItems),
    enabled: !!userId,
  });
}
