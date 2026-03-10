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
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';
import { fixed } from '@/theme/tokens';

export function createRoomScreenStyles(colors: ThemeColors) {
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
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
      color: colors.textInverse,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
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
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
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
      paddingVertical: spacing.medium,
      backgroundColor: withAlpha(colors.surface, 0.8),
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
      overflow: 'hidden',
    },
    backButton: {
      ...shared.iconButton,
    },
    backButtonText: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerSubtitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginTop: spacing.micro,
    },
    headerStatusText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
    },
    headerSeparator: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
    headerShareLink: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.primary,
    },
    headerRight: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.small,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.medium,
      // Extra bottom padding so content isn't hidden behind BottomActionPanel
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
  });
}
