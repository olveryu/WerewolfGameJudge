/** Current-user query contract; authentication owns identity, Query owns refreshed profile data. */
import { queryOptions } from '@tanstack/react-query';

import type { AuthSession, IAuthService } from '@/services/types/IAuthService';

export const authQueryKeys = {
  user: (userId: string | null) => ['authUser', userId] as const,
};

/** Seed from authentication, and reject responses belonging to a replaced session. */
export function currentUserOptions(authService: IAuthService, session: AuthSession | null) {
  return queryOptions({
    queryKey: authQueryKeys.user(session?.userId ?? null),
    queryFn: async ({ signal }) => {
      signal.throwIfAborted();
      if (session === null || authService.getAuthSession() !== session) {
        throw new DOMException('Authentication changed', 'AbortError');
      }
      const response = await authService.getCurrentUser(signal);
      signal.throwIfAborted();
      if (authService.getAuthSession() !== session) {
        throw new DOMException('Authentication changed', 'AbortError');
      }
      if (response === null || response.data.user.id !== session.userId) {
        throw new Error('Current user does not match the authenticated session');
      }
      return response.data.user;
    },
    initialData: session?.initialUser ?? undefined,
    enabled: session !== null,
    staleTime: Infinity,
    retry: false,
  });
}
