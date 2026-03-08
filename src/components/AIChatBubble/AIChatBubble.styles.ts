/**
 * AIChatBubble.styles — barrel file.
 *
 * Composes per-group style creators into a single flat ChatStyles object.
 * Owns layout constants and shared types consumed by sibling modules.
 * Does not contain style definitions — those live in bubble/chat/notepad sub-files.
 */

import { Dimensions, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createBubbleStyles } from './bubble.styles';
import { createChatStyles } from './chat.styles';
import { createNotepadStyles } from './notepad.styles';

// ── Layout constants ─────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
export const BUBBLE_SIZE = 56;
export const BUBBLE_MARGIN = 16;

/** 根据屏幕高度动态计算聊天窗口高度（55%，限制 320~600） */
export function getChatHeight(screenHeight: number): number {
  return Math.min(600, Math.max(320, Math.round(screenHeight * 0.55)));
}

/** Height of the "小助手" label below the bubble */
export const LABEL_HEIGHT = 18;

/** 默认位置：右下角 */
export const DEFAULT_POSITION = {
  x: SCREEN_WIDTH - BUBBLE_SIZE - BUBBLE_MARGIN,
  y: SCREEN_HEIGHT - BUBBLE_SIZE - LABEL_HEIGHT - 60,
};

// ── DisplayMessage 类型 ─────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── NotepadStyles（NotepadPanel 依赖此类型） ─────────────

export interface NotepadStyles {
  container: ViewStyle;
  list: ViewStyle;
  listContent: ViewStyle;
  card: ViewStyle;
  cardWolf: ViewStyle;
  cardGod: ViewStyle;
  cardVillager: ViewStyle;
  cardThird: ViewStyle;
  cardHeader: ViewStyle;
  seatBtn: ViewStyle;
  seatNumber: TextStyle;
  seatPlaceholder: TextStyle;
  roleBadge: ViewStyle;
  roleBadgeWolf: ViewStyle;
  roleBadgeGod: ViewStyle;
  roleBadgeVillager: ViewStyle;
  roleBadgeThird: ViewStyle;
  roleBadgeText: TextStyle;
  roleBadgeTextWolf: TextStyle;
  roleBadgeTextGod: TextStyle;
  roleBadgeTextVillager: TextStyle;
  roleBadgeTextThird: TextStyle;
  handTag: ViewStyle;
  handTagActive: ViewStyle;
  handTagText: TextStyle;
  handTagTextActive: TextStyle;
  noteInput: TextStyle;
  popoverOverlay: ViewStyle;
  popover: ViewStyle;
  popoverTitle: TextStyle;
  popoverGrid: ViewStyle;
  popoverTag: ViewStyle;
  popoverTagSelectedWolf: ViewStyle;
  popoverTagSelectedGod: ViewStyle;
  popoverTagSelectedVillager: ViewStyle;
  popoverTagSelectedThird: ViewStyle;
  popoverTagText: TextStyle;
  popoverTagTextWolf: TextStyle;
  popoverTagTextGod: TextStyle;
  popoverTagTextVillager: TextStyle;
  popoverTagTextThird: TextStyle;
  popoverTagTextSelected: TextStyle;
  popoverClearBtn: ViewStyle;
  popoverClearText: TextStyle;
  legend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendDotWolf: ViewStyle;
  legendDotGod: ViewStyle;
  legendDotVillager: ViewStyle;
  legendDotThird: ViewStyle;
  legendText: TextStyle;
}

// ── Factory ──────────────────────────────────────────────

export const createStyles = (colors: ThemeColors) => ({
  ...createBubbleStyles(colors, BUBBLE_SIZE),
  ...createChatStyles(colors, CHAT_WIDTH),
  ...createNotepadStyles(colors),
});

export type ChatStyles = ReturnType<typeof createStyles>;
