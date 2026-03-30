/**
 * RoomScreen component styles — barrel file.
 *
 * Composes per-group style creators into a single RoomScreenComponentStyles object.
 * Created once in RoomScreen and passed to all sub-components via props.
 * SeatTile/PlayerGrid have their own styles (performance: depends on tileSize).
 */
import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createBoardInfoStyles } from './boardInfo.styles';
import { createModalMenuStyles } from './modalMenu.styles';
import { createStatusPanelStyles } from './statusPanels.styles';

// ─── Per-component style interfaces ─────────────────────────────────────────

export interface BoardInfoCardStyles {
  boardInfoContainer: ViewStyle;
  headerRow: ViewStyle;
  headerRowRight: ViewStyle;
  boardInfoTitle: TextStyle;
  notepadBtn: ViewStyle;
  notepadBtnText: TextStyle;
  boardInfoContent: ViewStyle;
  roleCategory: ViewStyle;
  roleCategoryLabel: TextStyle;
  roleCategoryText: TextStyle;
  roleChipRow: ViewStyle;
  boardInfoHint: TextStyle;
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
  progressBarTrack: ViewStyle;
  progressBar: ViewStyle;
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

export interface HostMenuDropdownStyles {
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

// ─── Combined styles container ──────────────────────────────────────────────

interface RoomScreenComponentStyles {
  boardInfoCard: BoardInfoCardStyles;
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  hostGuideBanner: HostGuideBannerStyles;
  hostMenuDropdown: HostMenuDropdownStyles;
  nightProgressIndicator: NightProgressIndicatorStyles;
  seatConfirmModal: SeatConfirmModalStyles;
  statusRibbon: StatusRibbonStyles;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRoomScreenComponentStyles(colors: ThemeColors): RoomScreenComponentStyles {
  const statusPanels = createStatusPanelStyles(colors);
  return {
    ...createBoardInfoStyles(colors),
    ...statusPanels,
    ...createModalMenuStyles(colors),
    statusRibbon: statusPanels.statusRibbon,
  };
}
