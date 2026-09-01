/**
 * useAppVisibility — detects foreground/background visibility of the app.
 *
 * Web: document.visibilitychange (visible / hidden)
 * Native: AppState.addEventListener('change') (active vs background/inactive)
 *
 * Returns boolean: true = foreground visible, false = background/hidden.
 * Used to unmount decorative animations (flair / pet) when the app is not visible, reducing CPU/GPU overhead.
 */
import { useSyncExternalStore } from 'react';

import { getAppVisibility, subscribeToAppVisibility } from '@/services/infra/appVisibility';

// ── Server snapshot (SSR safety) ──────────────────────────────────────

function getServerSnapshot(): boolean {
  return true;
}

// ── Hook ──────────────────────────────────────────────────────────────

/** Returns whether the app is visible in the foreground (web: document.visibilityState / native: AppState). */
export function useAppVisibility(): boolean {
  return useSyncExternalStore(subscribeToAppVisibility, getAppVisibility, getServerSnapshot);
}
