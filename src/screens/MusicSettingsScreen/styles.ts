/**
 * MusicSettingsScreen styles
 *
 * Factory function accepting theme colors. Created once via useMemo in parent.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface MusicSettingsStyles {
  container: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  headerSpacer: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  card: ViewStyle;
  sectionHeader: ViewStyle;
  sectionTitleRow: ViewStyle;
  sectionTitle: TextStyle;
  randomRow: ViewStyle;
  randomLabel: TextStyle;
  randomLabelSelected: TextStyle;
  radioOuter: ViewStyle;
  radioOuterSelected: ViewStyle;
  radioInner: ViewStyle;
  volumeSection: ViewStyle;
  volumeRow: ViewStyle;
  volumeLabel: TextStyle;
  previewRow: ViewStyle;
  previewText: TextStyle;
  disabledOverlay: ViewStyle;
  bottomSpacer: ViewStyle;
}

export const createMusicSettingsStyles = (colors: ThemeColors): MusicSettingsStyles =>
  StyleSheet.create<MusicSettingsStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    },
    scrollContent: {
      padding: spacing.screenH,
    },
    card: {
      ...createSharedStyles(colors).cardBase,
      marginBottom: spacing.screenH,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.medium,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    sectionTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    randomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      marginBottom: spacing.tight,
    },
    randomLabel: {
      ...textStyles.body,
      color: colors.text,
      flex: 1,
    },
    randomLabelSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    radioOuter: {
      width: spacing.large,
      height: spacing.large,
      borderRadius: spacing.large / 2,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: spacing.small,
      height: spacing.small,
      borderRadius: spacing.small / 2,
      backgroundColor: colors.primary,
    },
    volumeSection: {
      marginTop: spacing.medium,
      paddingTop: spacing.medium,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: withAlpha(colors.border, 0.5),
    },
    volumeRow: {
      marginTop: spacing.small,
    },
    volumeLabel: {
      ...textStyles.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.small,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      marginTop: spacing.medium,
      paddingVertical: spacing.small,
    },
    previewText: {
      ...textStyles.body,
      color: colors.textSecondary,
    },
    disabledOverlay: {
      opacity: fixed.disabledOpacity,
    },
    bottomSpacer: {
      height: spacing.xlarge,
    },
  });
