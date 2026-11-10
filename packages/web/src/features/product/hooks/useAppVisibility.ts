/**
 * useAppVisibility — foreground/background visibility of the app from the shared environment.
 *
 * Used to unmount decorative animations (flair / pet) when the app is not visible.
 */
import { useSyncExternalStore } from 'react';

import { platformEnvironment } from '@/platform/env/PlatformEnvironment';

function getVisible(): boolean {
  return platformEnvironment.getSnapshot().visible;
}

function subscribe(listener: () => void): () => void {
  return platformEnvironment.subscribe(listener);
}

function getServerSnapshot(): boolean {
  return true;
}

/** Returns whether the app is visible in the foreground. */
export function useAppVisibility(): boolean {
  return useSyncExternalStore(subscribe, getVisible, getServerSnapshot);
}
