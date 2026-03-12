/**
 * Modal & menu styles — HostMenuDropdown, SeatConfirmModal.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
} from '@/theme';

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
        ...textStyles.headingBold,
        color: colors.text,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small,
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
        ...textStyles.titleBold,
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
        ...textStyles.bodySemibold,
        color: colors.textSecondary,
      },
      modalConfirmText: {
        ...textStyles.bodySemibold,
        color: colors.textInverse,
      },
    }),
  };
}
