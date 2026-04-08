/**
 * MusicSettingsScreen styles
 *
 * Factory function accepting theme colors. Created once via useMemo in parent.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
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
  cardTitle: TextStyle;
  row: ViewStyle;
  rowLabel: TextStyle;
  chipWrap: ViewStyle;
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
  trackRow: ViewStyle;
  trackInfo: ViewStyle;
  trackLabel: TextStyle;
  trackLabelSelected: TextStyle;
  playButton: ViewStyle;
  playingIndicator: TextStyle;
  volumeRow: ViewStyle;
  volumeLabel: TextStyle;
  previewRow: ViewStyle;
  previewText: TextStyle;
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
    cardTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.medium,
    },
    rowLabel: {
      ...textStyles.body,
      color: colors.text,
    },
    chipWrap: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    chip: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: withAlpha(colors.primary, 0.12),
      borderColor: colors.primary,
    },
    chipText: {
      ...textStyles.secondary,
      color: colors.text,
    },
    chipTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      marginBottom: spacing.tight,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    trackInfo: {
      flex: 1,
    },
    trackLabel: {
      ...textStyles.body,
      color: colors.text,
    },
    trackLabelSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    playButton: {
      width: componentSizes.button.sm,
      height: componentSizes.button.sm,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playingIndicator: {
      color: colors.primary,
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
    bottomSpacer: {
      height: spacing.xlarge,
    },
  });
