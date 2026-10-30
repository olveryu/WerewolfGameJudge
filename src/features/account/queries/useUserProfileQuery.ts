import { useQuery } from '@tanstack/react-query';

import { userProfileOptions } from './accountQueryOptions';

/**
 * useUserProfileQuery — public profile for a given user.
 * A null userId (no human to look up, e.g. a bot occupant) disables the query.
 */
export function useUserProfileQuery(userId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    ...userProfileOptions(userId ?? ''),
    enabled: userId !== null && userId.length > 0 && (options?.enabled ?? true),
  });
}
