/**
 * RoomScreen.styles.ts - Styles factory for RoomScreen
 *
 * ✅ Allowed:
 *   - Define all RoomScreen styles via createStyles factory
 *   - Use theme tokens exclusively (colors, spacing, typography, etc.)
 *
 * ❌ Do NOT:
 *   - Import services or game logic
 *   - Use hardcoded style values
 *   - Create per-component StyleSheets (styles are passed via props)
 */

import { StyleSheet } from 'react-native';

import { borderRadius, spacing, type ThemeColors,typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export function createRoomScreenStyles(colors: ThemeColors) {
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
      color: colors.textSecondary,
    },
    errorMessageText: {
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.large,
    },
    errorBackButton: {
      marginTop: spacing.large,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.medium,
    },
    errorBackButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
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
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButtonText: {
      color: colors.text,
      fontSize: typography.title,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight / 2,
    },
    headerSpacer: {
      minWidth: 60,
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
