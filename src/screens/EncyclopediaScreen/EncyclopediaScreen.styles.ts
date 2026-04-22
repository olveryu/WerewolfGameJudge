/**
 * EncyclopediaScreen styles — createStyles factory
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  fixed,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export function createEncyclopediaStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    headerIconButtonActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
    },
    // Search
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.screenH,
      marginTop: spacing.small,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      padding: 0,
    },
    // Faction Tabs
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      marginTop: spacing.small,
      marginBottom: spacing.small,
      gap: spacing.small,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    // Tag Dropdown Menu (Modal)
    dropdownOverlay: {
      flex: 1,
      backgroundColor: withAlpha(colors.background, 0.5),
      justifyContent: 'center',
      alignItems: 'center',
    },
    dropdownMenu: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
      minWidth: 200,
      maxWidth: '80%',
      ...shadows.md,
    },
    dropdownTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing.small,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      borderRadius: borderRadius.small,
    },
    dropdownItemActive: {
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    dropdownItemText: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    dropdownItemTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    dropdownItemCount: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.textMuted,
      marginRight: spacing.small,
    },
    dropdownItemCountActive: {
      color: colors.primary,
    },
    dropdownClearText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.error,
    },
    // Section List
    listStyle: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: spacing.xlarge,
    },
    gridRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    gridPlaceholder: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.screenH,
    },
    sectionAccent: {
      width: spacing.tight,
      height: typography.secondary,
      borderRadius: borderRadius.full,
      marginRight: spacing.small,
    },
    sectionTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.semibold,
    },
    // Empty State
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xlarge,
    },
    emptyText: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
      marginTop: spacing.medium,
    },
    emptyHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      marginTop: spacing.tight,
    },
  });
}

export type EncyclopediaStyles = ReturnType<typeof createEncyclopediaStyles>;
