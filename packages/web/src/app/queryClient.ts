/**
 * The app's TanStack Query client.
 *
 * Queries do not retry: `ApiClient` already retries idempotent requests on network failure, and
 * a second retry layer here would multiply waits (docs/web-client-rewrite.md §5.5). Failures that
 * are not network, abort or expected errors are reported to Sentry.
 */
import { captureException } from '@sentry/react';
import { focusManager, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { platformEnvironment } from '@/platform/env/PlatformEnvironment';
import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';

const PROFILE_STALE_MS = 2 * 60 * 1000;

focusManager.setEventListener((setFocused) => {
  const syncFocus = (): void => setFocused(platformEnvironment.getSnapshot().visible);
  const unsubscribe = platformEnvironment.subscribe(syncFocus);
  syncFocus();
  return unsubscribe;
});

function isReportable(error: unknown): boolean {
  return !isNetworkError(error) && !isAbortError(error) && !isExpectedError(error);
}

/** Global QueryClient, provided by `AppRoot`. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: PROFILE_STALE_MS, retry: false },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!isReportable(error)) return;
      captureException(error, { tags: { queryKey: JSON.stringify(query.queryKey[0]) } });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (!isReportable(error)) return;
      captureException(error, {
        tags: { mutationKey: JSON.stringify(mutation.options.mutationKey) },
      });
    },
  }),
});
