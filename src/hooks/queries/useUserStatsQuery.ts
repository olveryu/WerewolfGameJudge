import { userStatsOptions } from './queryOptions';
import { useAuthenticatedQuery } from './useAuthenticatedQuery';

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
