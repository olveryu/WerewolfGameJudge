import { useAuthContext } from '@/contexts/AuthContext';
import { useAuthenticatedQuery } from '@/features/auth/queries/useAuthenticatedQuery';

import { userStatsOptions } from './accountQueryOptions';

/**
 * Current user's growth data (XP / level / unlocked items).
 *
 * Anonymous users and pending auth make no request; every screen shares one cache key.
 */
export function useUserStatsQuery() {
  const { user } = useAuthContext();
  return useAuthenticatedQuery(userStatsOptions(user?.id ?? null));
}
