import { useQuery } from '@tanstack/react-query';

import { userProfileOptions } from './accountQueryOptions';

/** Public profile of a user; a null id (no human to look up, e.g. a bot occupant) disables it. */
export function useUserProfileQuery(userId: string | null) {
  return useQuery({
    ...userProfileOptions(userId ?? ''),
    enabled: userId !== null && userId.length > 0,
  });
}
