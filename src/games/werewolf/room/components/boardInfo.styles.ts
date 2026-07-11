/**
 * BoardInfoCard + NightProgressIndicator styles.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface BoardInfoCardStyles {
  boardInfoContainer: ViewStyle;
  headerRow: ViewStyle;
  headerRowRight: ViewStyle;
  boardInfoTitle: TextStyle;
  notepadBtn: ViewStyle;
  notepadBtnText: TextStyle;
  boardInfoContent: ViewStyle;
  roleCategory: ViewStyle;
  roleCategoryLabel: TextStyle;
  roleCategoryText: TextStyle;
  roleChipRow: ViewStyle;
  boardInfoHint: TextStyle;
  nominationButtonRow: ViewStyle;
  nominationBtn: ViewStyle;
  nominationBtnText: TextStyle;
}

export function createBoardInfoStyles(colors: ThemeColors): BoardInfoCardStyles {
  return StyleSheet.create<BoardInfoCardStyles>({
    boardInfoContainer: {
      ...createSharedStyles(colors).cardBase,
      backgroundColor: colors.surface,
      marginBottom: spacing.medium,
      borderTopWidth: fixed.borderWidthHighlight,
      borderTopColor: colors.border,
      ...shadows.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
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
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textMuted,
      flex: 1,
    },
    nominationButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      marginTop: spacing.small,
    },
    nominationBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
      backgroundColor: withAlpha(colors.primary, 0.1),
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
    },
    nominationBtnText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
  });
}
