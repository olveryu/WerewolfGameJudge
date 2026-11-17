import { useCallback, useSyncExternalStore } from 'react';

/** Display-only: the engine still checks the authoritative timestamp on every claim. */
export function useSpotmatchCooldown(lockedUntil: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = window.setTimeout(onChange, Math.max(0, lockedUntil - Date.now()));
      return () => window.clearTimeout(timer);
    },
    [lockedUntil],
  );
  const getSnapshot = useCallback(() => lockedUntil > Date.now(), [lockedUntil]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
