import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void): () => void {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
}

/** The layout viewport width in CSS pixels, updated on resize. */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, () => document.documentElement.clientWidth);
}
