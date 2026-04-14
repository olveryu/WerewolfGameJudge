import { useQuery } from '@tanstack/react-query';

import { fetchUserProfile } from '@/services/feature/StatsService';

import { queryKeys } from './queryKeys';

/**
 * useUserProfileQuery — 指定用户的公开资料。
 * `enabled` 默认要求 userId 非空。
 */
export function useUserProfileQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId && (options?.enabled ?? true),
  });
}
