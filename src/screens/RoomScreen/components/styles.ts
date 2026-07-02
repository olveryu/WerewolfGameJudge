/**
 * RoomScreen component styles — barrel file.
 *
 * Composes per-group style creators into a single RoomScreenComponentStyles object.
 * Created once in RoomScreen and passed to all sub-components via props.
 * SeatTile/PlayerGrid have their own styles (performance: depends on tileSize).
 */
import type { TextStyle, ViewStyle } from 'react-native';

import {
  type BottomActionPanelStyles,
  type ConnectionStatusBarStyles,
  type ControlledSeatBannerStyles,
  createRoomComponentStyles,
  type HostGuideBannerStyles,
  type RoomComponentStyles,
  type RoomStatusRibbonStyles,
} from '@/components/room/roomComponentStyles';
import type { ThemeColors } from '@/theme';

import { createBoardInfoStyles } from './boardInfo.styles';

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
  nominationButtonRow: ViewStyle;
  nominationBtn: ViewStyle;
  nominationBtnText: TextStyle;
}

export type {
  BottomActionPanelStyles,
  ConnectionStatusBarStyles,
  ControlledSeatBannerStyles,
  HostGuideBannerStyles,
};
export type StatusRibbonStyles = RoomStatusRibbonStyles;

export interface NightProgressIndicatorStyles {
  container: ViewStyle;
  headerRow: ViewStyle;
  stepText: TextStyle;
  roleText: TextStyle;
  progressBarContainer: ViewStyle;
  progressBarFill: ViewStyle;
}

// ─── Combined styles container ──────────────────────────────────────────────

interface RoomScreenComponentStyles extends RoomComponentStyles {
  boardInfoCard: BoardInfoCardStyles;
  nightProgressIndicator: NightProgressIndicatorStyles;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createRoomScreenComponentStyles(colors: ThemeColors): RoomScreenComponentStyles {
  return {
    ...createBoardInfoStyles(colors),
    ...createRoomComponentStyles(colors),
  };
}
