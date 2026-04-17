import { useQuery } from '@tanstack/react-query';

import { useAuthContext } from '@/contexts/AuthContext';
import { fetchUserStats } from '@/services/feature/StatsService';

import { queryKeys } from './queryKeys';

/**
 * useUserStatsQuery — 当前用户的成长数据（XP/等级/解锁物品）。
 *
 * 匿名用户 / auth 未完成时 enabled=false，不发请求。
 * 多屏幕共享同一 cache key，避免重复 fetch。
 */
export function useUserStatsQuery(options?: { enabled?: boolean }) {
  const { user, loading } = useAuthContext();
  const canFetch = !loading && !!user && !user.isAnonymous;

  return useQuery({
    queryKey: queryKeys.userStats(),
    queryFn: fetchUserStats,
    ...options,
    enabled: canFetch && (options?.enabled ?? true),
  });
}
