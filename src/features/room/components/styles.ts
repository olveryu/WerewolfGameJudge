/** Stable styles shared by all room-shell consumers. */

import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createModalMenuStyles } from './modalMenu.styles';
import { createStatusPanelStyles } from './statusPanels.styles';

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

export interface StatusRibbonStyles {
  speakingOrderContainer: ViewStyle;
  speakingOrderIcon: TextStyle;
  speakingOrderTextContainer: ViewStyle;
  speakingOrderText: TextStyle;
  speakingOrderSubText: TextStyle;
}

export interface HeaderActionsStyles {
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
}

export interface RoomFeatureStyles {
  readonly bottomActionPanel: BottomActionPanelStyles;
  readonly connectionStatusBar: ConnectionStatusBarStyles;
  readonly controlledSeatBanner: ControlledSeatBannerStyles;
  readonly hostGuideBanner: HostGuideBannerStyles;
  readonly headerActions: HeaderActionsStyles;
  readonly nightProgressIndicator: NightProgressIndicatorStyles;
  readonly seatConfirmModal: SeatConfirmModalStyles;
  readonly statusRibbon: StatusRibbonStyles;
}

export function createRoomFeatureStyles(colors: ThemeColors): RoomFeatureStyles {
  const statusPanels = createStatusPanelStyles(colors);
  return {
    ...statusPanels,
    ...createModalMenuStyles(colors),
    statusRibbon: statusPanels.statusRibbon,
  };
}
