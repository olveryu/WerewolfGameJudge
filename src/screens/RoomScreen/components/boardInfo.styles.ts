/**
 * BoardInfoCard + NightProgressIndicator styles.
 */
import { StyleSheet } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';
import { fixed } from '@/theme/tokens';

import type { BoardInfoCardStyles, NightProgressIndicatorStyles } from './styles';

export function createBoardInfoStyles(colors: ThemeColors): {
  boardInfoCard: BoardInfoCardStyles;
  nightProgressIndicator: NightProgressIndicatorStyles;
} {
  return {
    boardInfoCard: StyleSheet.create<BoardInfoCardStyles>({
      boardInfoContainer: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.large,
        padding: spacing.medium,
        marginBottom: spacing.medium,
        ...shadows.sm,
      },
      headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      boardInfoTitle: {
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        fontWeight: typography.weights.bold,
        color: colors.text,
      },
      boardInfoContent: {
        marginTop: spacing.small,
        gap: spacing.tight,
      },
      roleCategory: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
      roleCategoryLabel: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        fontWeight: typography.weights.semibold,
        color: colors.textSecondary,
        width: spacing.xxlarge * 2 + spacing.tight, // ~70
      },
      roleCategoryText: {
        flex: 1,
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.text,
      },
      roleChipRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.tight,
      },
      speakingOrderContainer: {
        marginTop: spacing.small,
        paddingTop: spacing.small,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.border,
      },
      speakingOrderText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.primary,
      },
      speakingOrderSubText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.textMuted,
        marginTop: spacing.tight / 2,
      },
      boardInfoHint: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.small,
      },
    }),

    nightProgressIndicator: StyleSheet.create<NightProgressIndicatorStyles>({
      container: {
        paddingHorizontal: spacing.medium,
        paddingVertical: spacing.small,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.large,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        ...shadows.sm,
      },
      headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.tight,
      },
      stepText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        fontWeight: typography.weights.semibold,
        color: colors.text,
      },
      roleText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.textSecondary,
      },
      progressBarContainer: {
        height: spacing.tight, // 4
        backgroundColor: colors.border,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
      },
      progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
      },
    }),
  };
}
