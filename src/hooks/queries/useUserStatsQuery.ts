import { useQuery } from '@tanstack/react-query';

import { fetchUserStats } from '@/services/feature/StatsService';

import { queryKeys } from './queryKeys';

/**
 * useUserStatsQuery — 当前用户的成长数据（XP/等级/解锁物品）。
 * 多屏幕共享同一 cache key，避免重复 fetch。
 */
export function useUserStatsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.userStats(),
    queryFn: fetchUserStats,
    ...options,
  });
}
