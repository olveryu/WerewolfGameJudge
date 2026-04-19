/**
 * AnimationSettingsScreen styles
 *
 * Factory function accepting theme colors. Created once via useMemo in parent.
 */
import { StyleSheet, type ViewStyle } from 'react-native';

import {
  borderRadius,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  withAlpha,
} from '@/theme';

interface AnimationSettingsStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  previewContainer: ViewStyle;
  previewButton: ViewStyle;
}

export const createAnimationSettingsStyles = (colors: ThemeColors): AnimationSettingsStyles =>
  StyleSheet.create<AnimationSettingsStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    scrollContent: {
      padding: spacing.screenH,
    },
    previewContainer: {
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      ...shadows.lgUpward,
    },
    previewButton: {
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      backgroundColor: withAlpha(colors.primary, 0.08),
      ...textStyles.bodySemibold,
    },
  });
