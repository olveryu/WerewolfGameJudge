/**
 * roomComponentStyles — shared component style contracts for room shells.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createRoomModalMenuStyles } from './roomModalMenuStyles';
import { createRoomStatusPanelStyles } from './roomStatusPanelStyles';

export interface BottomActionPanelStyles {
  container: ViewStyle;
  message: TextStyle;
  buttonRow: ViewStyle;
  ghostRow: ViewStyle;
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
  hintContainer: ViewStyle;
  text: TextStyle;
  hintText: TextStyle;
  releaseButton: ViewStyle;
  releaseButtonText: TextStyle;
}

export interface HostGuideBannerStyles {
  container: ViewStyle;
  icon: TextStyle;
  text: TextStyle;
}

export interface RoomStatusRibbonStyles {
  speakingOrderContainer: ViewStyle;
  speakingOrderIcon: TextStyle;
  speakingOrderTextContainer: ViewStyle;
  speakingOrderText: TextStyle;
  speakingOrderSubText: TextStyle;
}

export interface RoomHeaderActionsStyles {
  triggerButton: ViewStyle;
  triggerText: TextStyle;
  modalOverlay: ViewStyle;
  menuArrow: ViewStyle;
  menuContainer: ViewStyle;
  menuItem: ViewStyle;
  menuItemText: TextStyle;
  menuItemDanger: ViewStyle;
  menuItemTextDanger: TextStyle;
  sectionGap: ViewStyle;
  headerRightContainer: ViewStyle;
}

export interface RoomSeatConfirmModalStyles {
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalTitle: TextStyle;
  modalMessage: TextStyle;
  modalButtons: ViewStyle;
  modalButton: ViewStyle;
}

export interface RoomComponentStyles {
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  hostGuideBanner: HostGuideBannerStyles;
  headerActions: RoomHeaderActionsStyles;
  seatConfirmModal: RoomSeatConfirmModalStyles;
  statusRibbon: RoomStatusRibbonStyles;
}

export function createRoomComponentStyles(colors: ThemeColors): RoomComponentStyles {
  const statusPanels = createRoomStatusPanelStyles(colors);
  return {
    ...statusPanels,
    ...createRoomModalMenuStyles(colors),
    statusRibbon: statusPanels.statusRibbon,
  };
}
