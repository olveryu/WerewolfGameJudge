/**
 * RoomScreen.styles.ts - Styles factory for RoomScreen
 *
 * Defines all RoomScreen styles via createStyles factory using theme tokens
 * exclusively (colors, spacing, typography, etc.). Does not import services
 * or game logic, does not use hardcoded style values, and does not create
 * per-component StyleSheets (styles are passed via props).
 */

import { StyleSheet } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  fixed,
  layout,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export function createRoomScreenStyles(colors: ThemeColors) {
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.transparent,
    },
    loadingText: {
      marginTop: spacing.medium,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.textSecondary,
    },
    errorMessageText: {
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.large,
    },
    errorBackButton: {
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    errorBackButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
    errorSecondaryButton: {
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surfaceHover,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    errorSecondaryButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textSecondary,
    },
    retryButtonRow: {
      flexDirection: 'row',
      gap: spacing.small + spacing.tight, // ~12
      marginTop: spacing.large,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: withAlpha(colors.surface, 0.85),
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: withAlpha(colors.primary, 0.15),
      overflow: 'hidden',
    },
    backButton: {
      ...shared.iconButton,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      zIndex: 1,
    },
    backButtonText: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
    },
    headerCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerRight: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.small,
      zIndex: 1,
    },
    headerLeft: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.small,
      zIndex: 1,
    },
    scrollView: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    scrollContent: {
      padding: spacing.medium,
      // Extra bottom padding so content isn't hidden behind BottomActionPanel
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
    hiddenShareCardContainer: {
      position: 'absolute',
      top: -9999,
      left: -9999,
    },
  });
}
