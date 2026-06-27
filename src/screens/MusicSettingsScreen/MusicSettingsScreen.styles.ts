/**
 * MusicSettingsScreen styles
 *
 * Factory function accepting theme colors. Created once via useMemo in parent.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

interface MusicSettingsStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  card: ViewStyle;
  sectionHeader: ViewStyle;
  sectionTitleRow: ViewStyle;
  sectionTitle: TextStyle;
  randomRow: ViewStyle;
  randomLabel: TextStyle;
  randomLabelSelected: TextStyle;
  trackListScroll: ViewStyle;
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

/** Create music settings screen styles. */
export const createMusicSettingsStyles = (colors: ThemeColors): MusicSettingsStyles =>
  StyleSheet.create<MusicSettingsStyles>({
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
      backgroundColor: withAlpha(colors.background, 0.8),
      borderRadius: borderRadius.medium,
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
    // Fixed-height scroll viewport for the track list (~4 rows visible).
    // Keeps the card compact as the track count grows; inner list scrolls.
    trackListScroll: {
      maxHeight: 280,
    },
    radioOuter: {
      width: spacing.large,
      height: spacing.large,
      borderRadius: spacing.large / 2,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    radioOuterSelected: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.06),
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
