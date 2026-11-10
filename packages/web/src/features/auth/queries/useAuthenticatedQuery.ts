/**
 * useAuthenticatedQuery — auth-aware base query hook.
 *
 * enabled=false when auth is not yet complete or the user is anonymous; no request is made.
 * All query hooks that require an authenticated user should be built on this hook.
 */

import {
  type QueryKey,
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useAuthContext } from '@/contexts/AuthContext';

export function useAuthenticatedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
  const { user, loading } = useAuthContext();
  const canFetch = !loading && !!user && !user.isAnonymous;

  return useQuery({
    ...options,
    enabled: canFetch ? (options.enabled ?? true) : false,
  });
}
