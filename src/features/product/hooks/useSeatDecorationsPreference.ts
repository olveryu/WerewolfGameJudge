/**
 * useSeatDecorationsPreference — whether the room grid should render seat decorations.
 *
 * Combines the user's 「座位装饰」 setting (SettingsService, persisted) with the system
 * reduced-motion preference: either one turns the decorative loops off. Reads the setting
 * through `useSyncExternalStore` so a change in the Settings screen applies to an open room.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { useServices } from '@/contexts/ServiceContext';

export function useSeatDecorationsPreference(): boolean {
  const { settingsService } = useServices();
  const subscribe = useCallback(
    (listener: () => void) => settingsService.addListener(listener),
    [settingsService],
  );
  const getSnapshot = useCallback(
    () => settingsService.isSeatDecorationsEnabled(),
    [settingsService],
  );
  const isEnabledInSettings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const reducedMotion = useReducedMotion();
  return isEnabledInSettings && !reducedMotion;
}
