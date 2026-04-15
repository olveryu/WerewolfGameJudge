/**
 * AnimationSettingsScreen styles
 *
 * Factory function accepting theme colors. Created once via useMemo in parent.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

interface AnimationSettingsStyles {
  container: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  headerSpacer: ViewStyle;
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
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
