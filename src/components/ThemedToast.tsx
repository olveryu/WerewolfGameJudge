/**
 * ThemedToast - Theme-aware Toast notification component
 *
 * Wraps react-native-toast-message with a custom config that uses the app's
 * ThemeColors (card / text / border / status colors) and design tokens.
 * Renders a `<Toast config={...} />` that automatically adapts to the active theme.
 *
 * Does not contain business logic — purely presentational wiring.
 */
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Toast, { BaseToast, type BaseToastProps } from 'react-native-toast-message';

import { useTheme } from '@/theme';
import type { ThemeColors } from '@/theme/themes';
import { borderRadius, shadows, spacing, typography } from '@/theme/tokens';

const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 5,
    borderRadius: borderRadius.medium,
    ...shadows.md,
  },
  content: {
    paddingHorizontal: spacing.medium,
  },
  text1: {
    fontSize: typography.secondary,
    fontWeight: '600',
  },
  text2: {
    fontSize: typography.caption,
  },
});

function themedToast(colors: ThemeColors, accentColor: string, displayName: string) {
  const ThemedBaseToast = (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={[styles.base, { borderLeftColor: accentColor, backgroundColor: colors.card }]}
      contentContainerStyle={styles.content}
      text1Style={[styles.text1, { color: colors.text }]}
      text2Style={[styles.text2, { color: colors.textSecondary }]}
    />
  );
  ThemedBaseToast.displayName = displayName;
  return ThemedBaseToast;
}

export function ThemedToast() {
  const { colors } = useTheme();

  const toastConfig = useMemo(
    () => ({
      success: themedToast(colors, colors.success, 'SuccessToast'),
      error: themedToast(colors, colors.error, 'ErrorToast'),
      info: themedToast(colors, colors.info, 'InfoToast'),
    }),
    [colors],
  );

  return <Toast config={toastConfig} />;
}
