/**
 * Bubble floating button styles.
 *
 * Bubble container, icon, label and pulse ring.
 * `bubbleSize` is injected from the barrel to avoid circular imports.
 */
import { StyleSheet } from 'react-native';

import { shadows, type ThemeColors, typography } from '@/theme';

export function createBubbleStyles(colors: ThemeColors, bubbleSize: number) {
  return StyleSheet.create({
    bubbleContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: bubbleSize,
      alignItems: 'center',
      zIndex: 1000,
      overflow: 'visible',
    },
    bubble: {
      width: bubbleSize,
      height: bubbleSize,
      borderRadius: bubbleSize / 2,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.lg,
    },
    bubbleIcon: {
      fontSize: 28,
    },
    bubbleLabel: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginTop: 2,
    },
    pulseRing: {
      position: 'absolute',
      width: bubbleSize,
      height: bubbleSize,
      borderRadius: bubbleSize / 2,
      borderWidth: 3,
      borderColor: colors.primary,
    },
  });
}
