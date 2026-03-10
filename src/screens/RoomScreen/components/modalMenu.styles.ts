/**
 * Modal & menu styles — HostMenuDropdown, SeatConfirmModal.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  shadows,
  spacing,
  type ThemeColors,
  typography,
} from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

import type { HostMenuDropdownStyles, SeatConfirmModalStyles } from './styles';

export function createModalMenuStyles(colors: ThemeColors): {
  hostMenuDropdown: HostMenuDropdownStyles;
  seatConfirmModal: SeatConfirmModalStyles;
} {
  const shared = createSharedStyles(colors);

  return {
    hostMenuDropdown: StyleSheet.create<HostMenuDropdownStyles>({
      headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: componentSizes.headerAction.minWidth,
      },
      triggerButton: {
        ...shared.iconButton,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
      },
      triggerText: {
        fontSize: typography.heading,
        lineHeight: typography.lineHeights.heading,
        color: colors.text,
        fontWeight: typography.weights.bold,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlayLight,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: componentSizes.header + spacing.small,
        paddingRight: spacing.medium,
      },
      menuContainer: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.medium,
        minWidth: componentSizes.menu.minWidth,
        ...shadows.md,
        overflow: 'hidden',
      },
      menuItem: {
        paddingVertical: spacing.medium,
        paddingHorizontal: spacing.large,
      },
      menuItemText: {
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        color: colors.text,
      },
      menuItemDanger: {},
      menuItemTextDanger: {
        color: colors.error,
      },
      separator: {
        height: fixed.divider,
        backgroundColor: colors.border,
        marginHorizontal: spacing.medium,
      },
    }),

    seatConfirmModal: StyleSheet.create<SeatConfirmModalStyles>({
      modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xlarge,
        padding: spacing.xlarge,
        minWidth: spacing.xxlarge * 6 + spacing.large, // ~280
        alignItems: 'center',
      },
      modalTitle: {
        fontSize: typography.title,
        lineHeight: typography.lineHeights.title,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.small,
      },
      modalMessage: {
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        color: colors.textSecondary,
        marginBottom: spacing.large,
        textAlign: 'center',
      },
      modalButtons: {
        flexDirection: 'row',
        gap: spacing.medium,
      },
      modalButton: {
        paddingHorizontal: spacing.large,
        paddingVertical: spacing.medium,
        borderRadius: borderRadius.medium,
        minWidth: spacing.xxlarge * 2 + spacing.medium, // ~100
        alignItems: 'center',
      },
      modalCancelButton: {
        backgroundColor: colors.surfaceHover,
        borderWidth: fixed.borderWidth,
        borderColor: colors.border,
      },
      modalConfirmButton: {
        backgroundColor: colors.primary,
      },
      modalCancelText: {
        color: colors.textSecondary,
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        fontWeight: typography.weights.semibold,
      },
      modalConfirmText: {
        color: colors.textInverse,
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        fontWeight: typography.weights.semibold,
      },
    }),
  };
}
