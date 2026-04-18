/**
 * useAuthenticatedQuery — auth-aware base query hook.
 *
 * auth 未完成 / 匿名用户时 enabled=false，不发请求。
 * 所有需要认证用户的 query hook 应通过此 hook 构建。
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { useAuthContext } from '@/contexts/AuthContext';

export function useAuthenticatedQuery<TData>(
  options: UseQueryOptions<TData> & { enabled?: boolean },
): UseQueryResult<TData> {
  const { user, loading } = useAuthContext();
  const canFetch = !loading && !!user && !user.isAnonymous;

  return useQuery({
    ...options,
    enabled: canFetch && (options.enabled ?? true),
  });
}
