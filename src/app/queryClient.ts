/**
 * queryClient — global TanStack Query instance configuration.
 *
 * Unifies staleTime / retry / global error reporting policy.
 * After Query/Mutation retries are exhausted, automatically reports to Sentry
 * (skips network/abort/expected errors).
 */
import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';

/** Global QueryClient instance, injected by QueryClientProvider in App.tsx. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min — stats/profile don't change rapidly
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: 0, // mutations do not retry by default; each mutation opts in itself
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Query still failed after retries exhausted — report to Sentry (skip network/abort/expected errors)
      if (isNetworkError(error) || isAbortError(error) || isExpectedError(error)) {
        return;
      }
      Sentry.captureException(error, {
        tags: { queryKey: JSON.stringify(query.queryKey[0] ?? 'unknown') },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      // Global mutation error log (no UI feedback; UI lives in each mutation's onError)
      // Skip expected errors: network errors (already retried), user cancellation, auth/validation errors
      if (isNetworkError(error) || isAbortError(error) || isExpectedError(error)) {
        return;
      }
      Sentry.captureException(error, {
        tags: { mutationKey: String(mutation.options.mutationKey ?? 'unknown') },
      });
    },
  }),
});
