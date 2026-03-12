/**
 * Bubble floating button styles.
 *
 * Circular FAB: icon on top + label below, vertical layout.
 * Uses theme tokens exclusively for full theme adaptability.
 * `bubbleHeight` / `bubbleWidth` injected from the barrel to avoid circular imports.
 */
import { StyleSheet } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';
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
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: bubbleWidth,
      height: bubbleHeight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: fixed.borderWidth,
      borderColor: colors.borderLight,
      gap: spacing.micro,
      ...shadows.md,
    },
    bubbleLabel: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textAlign: 'center',
    },
    pulseRing: {
      position: 'absolute',
      width: bubbleWidth,
      height: bubbleHeight,
      borderRadius: borderRadius.full,
      borderWidth: 2,
      borderColor: colors.primary,
    },
  });
}
