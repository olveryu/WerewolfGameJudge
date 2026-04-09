/**
 * Modal & menu styles — HeaderActions, SeatConfirmModal.
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

import type { HeaderActionsStyles, SeatConfirmModalStyles } from './styles';

export function createModalMenuStyles(colors: ThemeColors): {
  headerActions: HeaderActionsStyles;
  seatConfirmModal: SeatConfirmModalStyles;
} {
  const shared = createSharedStyles(colors);

  return {
    headerActions: StyleSheet.create<HeaderActionsStyles>({
      headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
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
      menuArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: spacing.small,
        borderLeftColor: colors.surface + '00', // transparent (CSS triangle technique)
        borderRightWidth: spacing.small,
        borderRightColor: colors.surface + '00', // transparent (CSS triangle technique)
        borderBottomWidth: spacing.small,
        borderBottomColor: colors.surface,
        alignSelf: 'flex-end',
        marginRight: spacing.medium,
      },
      menuContainer: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.medium,
        minWidth: componentSizes.menu.minWidth,
        paddingVertical: spacing.tight,
        ...shadows.md,
        overflow: 'hidden',
      },
      menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small,
        paddingVertical: spacing.small,
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
      sectionGap: {
        height: fixed.divider,
        backgroundColor: colors.border,
        marginHorizontal: spacing.medium,
        marginVertical: spacing.tight,
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
        minWidth: componentSizes.modal.minWidth,
        maxWidth: '88%',
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
    }),
  };
}
