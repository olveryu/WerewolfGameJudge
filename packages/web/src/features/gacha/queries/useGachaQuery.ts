/** Gacha status query (ticket count, pity, unlocked count, daily reward status). */

import { useAuthContext } from '@/contexts/AuthContext';
import { useAuthenticatedQuery } from '@/features/auth/queries/useAuthenticatedQuery';

import { gachaStatusOptions } from './gachaQueryOptions';

/** Disabled for anonymous users and while auth is loading; no request is made then. */
export function useGachaStatusQuery() {
  const { user } = useAuthContext();
  return useAuthenticatedQuery(gachaStatusOptions(user?.id ?? null));
}
