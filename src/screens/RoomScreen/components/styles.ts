/**
 * RoomScreen component styles - Shared styles factory
 *
 * Created once in RoomScreen and passed to all sub-components via props.
 * This avoids redundant StyleSheet.create calls per component.
 *
 * Each component receives only its own sub-styles via the grouped interface.
 * SeatTile/PlayerGrid have their own styles (performance: depends on tileSize).
 */
import { StyleSheet, Platform, type ViewStyle, type TextStyle } from 'react-native';
import {
  type ThemeColors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

// ─── Per-component style interfaces ─────────────────────────────────────────

export interface ActionButtonStyles {
  actionButton: ViewStyle;
  disabledButton: ViewStyle;
  buttonText: TextStyle;
}

export interface ActionMessageStyles {
  actionMessage: TextStyle;
}

export interface BoardInfoCardStyles {
  boardInfoContainer: ViewStyle;
  headerRow: ViewStyle;
  boardInfoTitle: TextStyle;
  collapseIcon: TextStyle;
  boardInfoContent: ViewStyle;
  roleCategory: ViewStyle;
  roleCategoryLabel: TextStyle;
  roleCategoryText: TextStyle;
}

export interface BottomActionPanelStyles {
  container: ViewStyle;
  message: TextStyle;
  buttonRow: ViewStyle;
}

export interface ConnectionStatusBarStyles {
  container: ViewStyle;
  statusLive: ViewStyle;
  statusSyncing: ViewStyle;
  statusConnecting: ViewStyle;
  statusDisconnected: ViewStyle;
  statusText: TextStyle;
  syncButton: ViewStyle;
  syncButtonDisabled: ViewStyle;
  syncButtonText: TextStyle;
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

export interface RoomScreenComponentStyles {
  actionButton: ActionButtonStyles;
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

export function createRoomScreenComponentStyles(
  colors: ThemeColors,
): RoomScreenComponentStyles {
  return {
    actionButton: StyleSheet.create<ActionButtonStyles>({
      actionButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.large,
        paddingVertical: spacing.medium,
        borderRadius: borderRadius.full,
        marginBottom: spacing.small,
      },
      disabledButton: {
        backgroundColor: colors.textMuted,
      },
      buttonText: {
        color: colors.textInverse,
        fontSize: typography.secondary,
        fontWeight: typography.weights.semibold,
      },
    }),

    actionMessage: StyleSheet.create<ActionMessageStyles>({
      actionMessage: {
        textAlign: 'center',
        fontSize: typography.body,
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
        fontWeight: typography.weights.bold,
        color: colors.text,
      },
      collapseIcon: {
        fontSize: typography.secondary,
        color: colors.textSecondary,
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
        fontWeight: typography.weights.semibold,
        color: colors.textSecondary,
        width: spacing.xxlarge * 2 + spacing.tight, // ~70
      },
      roleCategoryText: {
        flex: 1,
        fontSize: typography.secondary,
        color: colors.text,
        lineHeight: typography.title, // ~20
      },
    }),

    bottomActionPanel: StyleSheet.create<BottomActionPanelStyles>({
      container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.large,
        borderTopRightRadius: borderRadius.large,
        paddingTop: spacing.medium,
        paddingHorizontal: spacing.medium,
        paddingBottom: spacing.xlarge,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        // Upward shadow — directional override not suited for global shadow tokens
        ...Platform.select({
          ios: {
            shadowColor: shadows.md.shadowColor,
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
          },
          android: {
            elevation: 8,
          },
          web: {
            boxShadow: '0 -3px 12px rgba(0, 0, 0, 0.08)',
          },
        }),
      },
      message: {
        textAlign: 'center',
        fontSize: typography.body,
        color: colors.text,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
        lineHeight: typography.body * 1.4,
      },
      buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.small,
      },
    }),

    connectionStatusBar: StyleSheet.create<ConnectionStatusBarStyles>({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.medium,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.large,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        ...shadows.sm,
      },
      statusLive: {
        backgroundColor: colors.success + '20',
      },
      statusSyncing: {
        backgroundColor: colors.warning + '20',
      },
      statusConnecting: {
        backgroundColor: colors.info + '20',
      },
      statusDisconnected: {
        backgroundColor: colors.error + '20',
      },
      statusText: {
        fontSize: typography.secondary,
        color: colors.text,
        fontWeight: typography.weights.medium,
      },
      syncButton: {
        marginLeft: spacing.medium,
        paddingHorizontal: spacing.medium,
        paddingVertical: spacing.tight,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.small,
      },
      syncButtonDisabled: {
        backgroundColor: colors.textMuted,
      },
      syncButtonText: {
        fontSize: typography.secondary,
        color: colors.textInverse,
        fontWeight: typography.weights.semibold,
      },
    }),

    controlledSeatBanner: StyleSheet.create<ControlledSeatBannerStyles>({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.warning + '20',
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
        backgroundColor: colors.warning + '20',
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
        color: colors.text,
        fontWeight: typography.weights.semibold,
        flex: 1,
      },
      hintText: {
        fontSize: typography.secondary,
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
        width: componentSizes.avatar.sm,
        height: componentSizes.avatar.sm,
        justifyContent: 'center',
        alignItems: 'center',
      },
      triggerText: {
        fontSize: typography.heading,
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
        fontWeight: typography.weights.semibold,
        color: colors.text,
      },
      roleText: {
        fontSize: typography.secondary,
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
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.small,
      },
      modalMessage: {
        fontSize: typography.body,
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
        fontWeight: typography.weights.semibold,
      },
      modalConfirmText: {
        color: colors.textInverse,
        fontSize: typography.body,
        fontWeight: typography.weights.semibold,
      },
    }),
  };
}
