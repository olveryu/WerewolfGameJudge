/**
 * BoardsGuideContent styles
 */
import { StyleSheet } from 'react-native';

import { borderRadius, fixed, spacing, type ThemeColors, typography, withAlpha } from '@/theme';

export function createBoardsGuideStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.tight,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.small,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    categoryBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      marginBottom: spacing.small,
      gap: spacing.small,
    },
    categoryChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    categoryChipActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderColor: colors.primary,
    },
    categoryText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    categoryTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: spacing.screenH,
      paddingBottom: spacing.xlarge,
    },
    listContentNoPad: {
      paddingBottom: spacing.xlarge,
    },
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
      color: colors.textMuted,
      marginTop: spacing.medium,
    },
    emptyHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
      marginTop: spacing.tight,
    },
    activeFilterRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      marginBottom: spacing.small,
    },
    activeFilterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    activeFilterText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },
  });
}
