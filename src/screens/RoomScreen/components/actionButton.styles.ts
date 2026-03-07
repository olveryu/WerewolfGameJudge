/**
 * ActionButton / DangerButton + ActionMessage styles.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import type { ActionButtonStyles } from './styles';

interface ActionMessageStyles {
  actionMessage: TextStyle;
}

export function createActionButtonStyles(colors: ThemeColors): {
  actionButton: ActionButtonStyles;
  dangerActionButton: ActionButtonStyles;
  actionMessage: ActionMessageStyles;
} {
  const actionButtonBase: ViewStyle = {
    minHeight: componentSizes.button.md,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const disabledButtonBase: ViewStyle = {
    backgroundColor: colors.textMuted,
  };
  const buttonTextBase: TextStyle = {
    color: colors.textInverse,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
  };

  return {
    actionButton: StyleSheet.create<ActionButtonStyles>({
      actionButton: { ...actionButtonBase, backgroundColor: colors.primary },
      disabledButton: disabledButtonBase,
      buttonText: buttonTextBase,
    }),
    dangerActionButton: StyleSheet.create<ActionButtonStyles>({
      actionButton: { ...actionButtonBase, backgroundColor: colors.error },
      disabledButton: disabledButtonBase,
      buttonText: buttonTextBase,
    }),
    actionMessage: StyleSheet.create<ActionMessageStyles>({
      actionMessage: {
        textAlign: 'center',
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        color: colors.text,
        marginTop: spacing.medium,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.medium,
      },
    }),
  };
}
