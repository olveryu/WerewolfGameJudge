/**
 * RoomScreen component styles - Shared styles factory
 *
 * Created once in RoomScreen and passed to all sub-components via props.
 * This avoids redundant StyleSheet.create calls per component.
 *
 * Each component receives only its own sub-styles via the grouped interface.
 * SeatTile/PlayerGrid have their own styles (performance: depends on tileSize).
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

// ─── Per-component style interfaces ─────────────────────────────────────────

export interface ActionButtonStyles {
  actionButton: ViewStyle;
  disabledButton: ViewStyle;
  buttonText: TextStyle;
}

interface ActionMessageStyles {
  actionMessage: TextStyle;
}

export interface BoardInfoCardStyles {
  boardInfoContainer: ViewStyle;
  headerRow: ViewStyle;
  boardInfoTitle: TextStyle;
  boardInfoContent: ViewStyle;
  roleCategory: ViewStyle;
  roleCategoryLabel: TextStyle;
  roleCategoryText: TextStyle;
  roleChipRow: ViewStyle;
  roleChip: ViewStyle;
  roleChipText: TextStyle;
  roleChipWolf: ViewStyle;
  roleChipGod: ViewStyle;
  roleChipThird: ViewStyle;
  roleChipVillager: ViewStyle;
  roleChipTextWolf: TextStyle;
  roleChipTextGod: TextStyle;
  roleChipTextThird: TextStyle;
  roleChipTextVillager: TextStyle;
  speakingOrderContainer: ViewStyle;
  speakingOrderText: TextStyle;
  speakingOrderSubText: TextStyle;
}

export interface BottomActionPanelStyles {
  container: ViewStyle;
  message: TextStyle;
  buttonRow: ViewStyle;
  secondaryRow: ViewStyle;
}

export interface ConnectionStatusBarStyles {
  container: ViewStyle;
  text: TextStyle;
  subtitleText: TextStyle;
  retryButton: ViewStyle;
  retryButtonText: TextStyle;
}

export interface ControlledSeatBannerStyles {
  container: ViewStyle;
  hintContainer: ViewStyle;
  text: TextStyle;
  hintText: TextStyle;
  releaseButton: ViewStyle;
  releaseButtonText: TextStyle;
}

export interface HostMenuDropdownStyles {
  triggerButton: ViewStyle;
  triggerText: TextStyle;
  modalOverlay: ViewStyle;
  menuContainer: ViewStyle;
  menuItem: ViewStyle;
  menuItemText: TextStyle;
  menuItemDanger: ViewStyle;
  menuItemTextDanger: TextStyle;
  separator: ViewStyle;
  headerRightContainer: ViewStyle;
}

export interface NightProgressIndicatorStyles {
  container: ViewStyle;
  headerRow: ViewStyle;
  stepText: TextStyle;
  roleText: TextStyle;
  progressBarContainer: ViewStyle;
  progressBarFill: ViewStyle;
}

export interface SeatConfirmModalStyles {
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalTitle: TextStyle;
  modalMessage: TextStyle;
  modalButtons: ViewStyle;
  modalButton: ViewStyle;
  modalCancelButton: ViewStyle;
  modalConfirmButton: ViewStyle;
  modalCancelText: TextStyle;
  modalConfirmText: TextStyle;
}

// ─── Combined styles container ──────────────────────────────────────────────

interface RoomScreenComponentStyles {
  actionButton: ActionButtonStyles;
  dangerActionButton: ActionButtonStyles;
  actionMessage: ActionMessageStyles;
  boardInfoCard: BoardInfoCardStyles;
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  hostMenuDropdown: HostMenuDropdownStyles;
  nightProgressIndicator: NightProgressIndicatorStyles;
  seatConfirmModal: SeatConfirmModalStyles;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRoomScreenComponentStyles(colors: ThemeColors): RoomScreenComponentStyles {
  const shared = createSharedStyles(colors);

  // ── ActionButton / DangerButton shared base ──
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
      actionButton: {
        ...actionButtonBase,
        backgroundColor: colors.primary,
      },
      disabledButton: disabledButtonBase,
      buttonText: buttonTextBase,
    }),

    dangerActionButton: StyleSheet.create<ActionButtonStyles>({
      actionButton: {
        ...actionButtonBase,
        backgroundColor: colors.error,
      },
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
        lineHeight: typography.title, // ~20
        color: colors.text,
      },
      roleChipRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.tight,
      },
      roleChip: {
        paddingHorizontal: spacing.small,
        paddingVertical: spacing.tight / 2,
        borderRadius: borderRadius.small,
        backgroundColor: colors.surfaceHover,
      },
      roleChipText: {
        fontSize: typography.secondary,
        lineHeight: typography.title, // ~20
        color: colors.primary,
      },
      roleChipWolf: {
        borderWidth: fixed.borderWidth,
        borderColor: colors.wolf,
      },
      roleChipGod: {
        borderWidth: fixed.borderWidth,
        borderColor: colors.god,
      },
      roleChipThird: {
        borderWidth: fixed.borderWidth,
        borderColor: colors.third,
      },
      roleChipVillager: {
        borderWidth: fixed.borderWidth,
        borderColor: colors.villager,
      },
      roleChipTextWolf: {
        color: colors.wolf,
      },
      roleChipTextGod: {
        color: colors.god,
      },
      roleChipTextThird: {
        color: colors.third,
      },
      roleChipTextVillager: {
        color: colors.villager,
      },
      speakingOrderContainer: {
        marginTop: spacing.small,
        paddingTop: spacing.small,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.border,
      },
      speakingOrderText: {
        fontSize: typography.secondary,
        lineHeight: typography.title,
        color: colors.primary,
      },
      speakingOrderSubText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.textMuted,
        marginTop: spacing.tight / 2,
      },
    }),

    bottomActionPanel: StyleSheet.create<BottomActionPanelStyles>({
      container: {
        backgroundColor: withAlpha(colors.surface, 0.8),
        borderTopLeftRadius: borderRadius.large,
        borderTopRightRadius: borderRadius.large,
        paddingTop: spacing.medium,
        paddingHorizontal: spacing.medium,
        paddingBottom: spacing.medium,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.borderLight,
        overflow: 'hidden',
        // Upward shadow
        ...shadows.upward,
      },
      message: {
        textAlign: 'center',
        fontSize: typography.body,
        lineHeight: typography.body * 1.4,
        color: colors.text,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
      },
      buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.small,
      },
      secondaryRow: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.small,
      },
    }),

    connectionStatusBar: StyleSheet.create<ConnectionStatusBarStyles>({
      container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.medium,
        backgroundColor: withAlpha(colors.error, 0.125),
        borderRadius: borderRadius.large,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        ...shadows.sm,
      },
      text: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.error,
        fontWeight: typography.weights.medium,
      },
      subtitleText: {
        width: '100%',
        textAlign: 'center',
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.error,
        opacity: 0.8,
        marginTop: spacing.micro,
      },
      retryButton: {
        marginLeft: spacing.small,
        paddingVertical: spacing.micro,
        paddingHorizontal: spacing.small,
        backgroundColor: withAlpha(colors.error, 0.188),
        borderRadius: borderRadius.medium,
      },
      retryButtonText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.error,
        fontWeight: typography.weights.semibold,
      },
    }),

    controlledSeatBanner: StyleSheet.create<ControlledSeatBannerStyles>({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.warning, 0.125),
        borderWidth: fixed.borderWidth,
        borderColor: colors.warning,
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginBottom: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      hintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.warning, 0.125),
        borderWidth: fixed.borderWidth,
        borderColor: colors.warning,
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginBottom: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      text: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.text,
        fontWeight: typography.weights.semibold,
        flex: 1,
      },
      hintText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.text,
        fontWeight: typography.weights.semibold,
      },
      releaseButton: {
        backgroundColor: colors.surface,
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.small,
        borderRadius: borderRadius.medium,
      },
      releaseButtonText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.text,
        fontWeight: typography.weights.semibold,
      },
    }),

    hostMenuDropdown: StyleSheet.create<HostMenuDropdownStyles>({
      headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 60,
      },
      triggerButton: {
        ...shared.iconButton,
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
        minWidth: 180,
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
      menuItemDanger: {
        // No additional style, just for semantic grouping
      },
      menuItemTextDanger: {
        color: colors.error,
      },
      separator: {
        height: fixed.divider,
        backgroundColor: colors.border,
        marginHorizontal: spacing.medium,
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
