/**
 * Modal and header-action styles — HeaderActions, SeatConfirmModal.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  createSharedStyles,
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
