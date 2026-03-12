/**
 * Bubble floating button styles.
 *
 * Capsule-shaped FAB: surface bg + borderLight border + icon + label in a row.
 * `bubbleHeight` / `bubbleWidth` injected from the barrel to avoid circular imports.
 */
import { StyleSheet } from 'react-native';

import { shadows, spacing, type ThemeColors, typography } from '@/theme';
import { fixed } from '@/theme/tokens';

export function createBubbleStyles(colors: ThemeColors, bubbleHeight: number, bubbleWidth: number) {
  return StyleSheet.create({
    bubbleContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      alignItems: 'center',
      zIndex: 1000,
      overflow: 'visible',
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      height: bubbleHeight,
      paddingHorizontal: spacing.medium,
      borderRadius: bubbleHeight / 2,
      backgroundColor: colors.surface,
      borderWidth: fixed.borderWidth,
      borderColor: colors.borderLight,
      gap: spacing.tight,
      ...shadows.md,
    },
    bubbleLabel: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    pulseRing: {
      position: 'absolute',
      width: bubbleWidth,
      height: bubbleHeight,
      borderRadius: bubbleHeight / 2,
      borderWidth: 3,
      borderColor: colors.primary,
    },
  });
}
