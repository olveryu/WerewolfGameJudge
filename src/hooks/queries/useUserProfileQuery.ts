import { useQuery } from '@tanstack/react-query';

import { userProfileOptions } from './queryOptions';

/**
 * useUserProfileQuery — public profile for a given user.
 * `enabled` defaults to requiring a non-empty userId.
 */
export function useUserProfileQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    ...userProfileOptions(userId),
    enabled: !!userId && (options?.enabled ?? true),
  });
}
