import { useSyncExternalStore } from 'react';

import { displaySettings } from '@/features/settings/displaySettings';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';

/** Whether seats show resident decorations: the user wants them and motion is allowed. */
export function useSeatDecorationsPreference(): boolean {
  const display = useSyncExternalStore(displaySettings.subscribe, displaySettings.getSnapshot);
  const prefersReducedMotion = usePrefersReducedMotion();
  return display.seatDecorationsEnabled && !prefersReducedMotion;
}
