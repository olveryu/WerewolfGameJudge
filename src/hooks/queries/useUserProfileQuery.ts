import { useQuery } from '@tanstack/react-query';

import { userProfileOptions } from './queryOptions';

/**
 * useUserProfileQuery — 指定用户的公开资料。
 * `enabled` 默认要求 userId 非空。
 */
export function useUserProfileQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...userProfileOptions(userId),
    enabled: !!userId && (options?.enabled ?? true),
  });
}
