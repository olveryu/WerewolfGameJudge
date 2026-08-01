import { useAuthenticatedQuery } from '@/features/auth/queries/useAuthenticatedQuery';

import { userStatsOptions } from './accountQueryOptions';

/**
 * useUserStatsQuery — Current user growth data (XP / level / unlocked items).
 *
 * Anonymous user / before auth completes: enabled=false, no request.
 * Multiple screens share one cache key, avoiding duplicate fetches.
 */
export function useUserStatsQuery(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery({
    ...userStatsOptions(),
    ...options,
  });
}
