/** Composes authentication and bounded resource readiness; App owns splash dismissal. */
import { useAuthContext } from '@/contexts/AuthContext';

import { useBootAssets } from './useBootAssets';

export { AVATAR_PREFETCH_TIMEOUT_MS } from './useBootAssets';

interface BootProgress {
  readonly isReady: boolean;
  readonly error: string | null;
  readonly retry: () => void;
}

/**
 * Tracks app boot progress (auth + avatar prefetch + font loading).
 *
 * Sets ready=true when all steps complete, allowing SplashScreen to hide.
 */
export function useBootProgress(): BootProgress {
  const { user, loading: authLoading, error: authError, retryInit } = useAuthContext();
  const { avatarPrefetched, fontLoaded } = useBootAssets(user?.avatarUrl, authLoading);

  const isReady = !authLoading && authError == null && avatarPrefetched && fontLoaded;
  return { isReady, error: authError, retry: retryInit };
}
