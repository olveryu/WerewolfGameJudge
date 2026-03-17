/**
 * BoardInfoCard + NightProgressIndicator styles.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import type { BoardInfoCardStyles, NightProgressIndicatorStyles } from './styles';

export function createBoardInfoStyles(colors: ThemeColors): {
  boardInfoCard: BoardInfoCardStyles;
  nightProgressIndicator: NightProgressIndicatorStyles;
} {
  return {
    boardInfoCard: StyleSheet.create<BoardInfoCardStyles>({
      boardInfoContainer: {
        ...createSharedStyles(colors).cardBase,
        marginBottom: spacing.medium,
      },
      headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      headerRowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.tight,
      },
      boardInfoTitle: {
        flex: 1,
        ...textStyles.subtitleSemibold,
        color: colors.text,
      },
      notepadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.micro,
        backgroundColor: withAlpha(colors.primary, 0.1),
        borderRadius: borderRadius.small,
        paddingHorizontal: spacing.small,
        paddingVertical: spacing.micro,
      },
      notepadBtnText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
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
        ...textStyles.secondarySemibold,
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
        ...textStyles.secondarySemibold,
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
