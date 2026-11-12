/** All admin reads share the same explicit-refresh, five-minute cache policy. */
import { queryOptions } from '@tanstack/react-query';

/** Keep keys credential-free, scoped to the admin session, and reusable across pages. */
export function adminQueryOptions<T>(
  page: string,
  parameters: unknown,
  load: (signal: AbortSignal) => Promise<T>,
) {
  return queryOptions({
    queryKey: ['admin', page, parameters],
    queryFn: ({ signal }) => load(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
