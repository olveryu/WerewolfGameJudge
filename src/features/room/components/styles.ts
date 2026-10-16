/** Stable styles shared by all room-shell consumers. */

import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createModalMenuStyles } from './modalMenu.styles';
import { createStatusPanelStyles } from './statusPanels.styles';

export interface BottomActionPanelStyles {
  container: ViewStyle;
  dockContainer: ViewStyle;
  progressRow: ViewStyle;
  message: TextStyle;
  buttonRow: ViewStyle;
  compactManagementStack: ViewStyle;
  ghostRow: ViewStyle;
  dockRow: ViewStyle;
  dockCenter: ViewStyle;
  dockPrimary: ViewStyle;
  dockToolRow: ViewStyle;
  toolSlot: ViewStyle;
  dockExpandedToolSlot: ViewStyle;
  infoRow: ViewStyle;
  infoAction: ViewStyle;
  hostManagementEntry: ViewStyle;
  hostManagementContent: ViewStyle;
  hostManagementTitleRow: ViewStyle;
  hostManagementTitle: TextStyle;
  hostManagementExpandRow: ViewStyle;
  hostManagementExpandLabel: TextStyle;
  hostManagementPending: TextStyle;
  nextStepReady: ViewStyle;
  nextStepContent: ViewStyle;
  nextStepReadyLabel: TextStyle;
  nextStepBlocked: ViewStyle;
  nextStepBlockedText: ViewStyle;
  nextStepBlockedLabel: TextStyle;
  nextStepBlockedReason: TextStyle;
}

export interface ConnectionStatusBarStyles {
  container: ViewStyle;
  text: TextStyle;
  progressBarTrack: ViewStyle;
  progressBar: ViewStyle;
  failedRow: ViewStyle;
  reconnectButton: ViewStyle;
  reconnectText: TextStyle;
}

export interface ControlledSeatBannerStyles {
  container: ViewStyle;
  text: TextStyle;
  releaseButton: ViewStyle;
  releaseButtonText: TextStyle;
}

export interface HeaderActionsStyles {
  triggerButton: ViewStyle;
  headerRightContainer: ViewStyle;
}

export interface RoomProgressIndicatorStyles {
  container: ViewStyle;
  headerRow: ViewStyle;
  stepText: TextStyle;
  labelText: TextStyle;
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
}

export interface RoomFeatureStyles {
  readonly bottomActionPanel: BottomActionPanelStyles;
  readonly connectionStatusBar: ConnectionStatusBarStyles;
  readonly controlledSeatBanner: ControlledSeatBannerStyles;
  readonly headerActions: HeaderActionsStyles;
  readonly progressIndicator: RoomProgressIndicatorStyles;
  readonly seatConfirmModal: SeatConfirmModalStyles;
}

export function createRoomFeatureStyles(colors: ThemeColors): RoomFeatureStyles {
  return {
    ...createStatusPanelStyles(colors),
    ...createModalMenuStyles(colors),
  };
}
