/**
 * ThemedToast - sonner-native Toaster wrapper with theme integration
 *
 * Wraps sonner-native <Toaster> with current dark/light theme.
 * Enables richColors for visually distinct success/error/warning states.
 *
 * Does not contain business logic — purely presentational wiring.
 */
import { Toaster } from 'sonner-native';

import { useTheme } from '@/theme';

export function ThemedToast() {
  const { isDark } = useTheme();

  return <Toaster theme={isDark ? 'dark' : 'light'} richColors position="bottom-center" />;
}
