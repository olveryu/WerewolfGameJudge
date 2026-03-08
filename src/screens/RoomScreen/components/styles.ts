/**
 * RoomScreen component styles — barrel file.
 *
 * Composes per-group style creators into a single RoomScreenComponentStyles object.
 * Created once in RoomScreen and passed to all sub-components via props.
 * SeatTile/PlayerGrid have their own styles (performance: depends on tileSize).
 */
import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createActionButtonStyles } from './actionButton.styles';
import { createBoardInfoStyles } from './boardInfo.styles';
import { createModalMenuStyles } from './modalMenu.styles';
import { createStatusPanelStyles } from './statusPanels.styles';

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
  return {
    ...createActionButtonStyles(colors),
    ...createBoardInfoStyles(colors),
    ...createStatusPanelStyles(colors),
    ...createModalMenuStyles(colors),
  };
}
