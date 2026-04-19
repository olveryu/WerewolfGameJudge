import { userStatsOptions } from './queryOptions';
import { useAuthenticatedQuery } from './useAuthenticatedQuery';

/**
 * useUserStatsQuery — 当前用户的成长数据（XP/等级/解锁物品）。
 *
 * 匿名用户 / auth 未完成时 enabled=false，不发请求。
 * 多屏幕共享同一 cache key，避免重复 fetch。
 */
export function useUserStatsQuery(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery({
    ...userStatsOptions(),
    ...options,
  });
}
