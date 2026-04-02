/**
 * AIChatBubble.styles — barrel file.
 *
 * Composes per-group style creators into a single flat ChatStyles object.
 * Owns layout constants and shared types consumed by sibling modules.
 * Does not contain style definitions — those live in bubble/chat sub-files.
 */

import { Dimensions } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createBubbleStyles } from './bubble.styles';
import { createChatStyles } from './chat.styles';

// ── Layout constants ─────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);

/** Badge dimensions (vertical: icon + label) */
export const BUBBLE_HEIGHT = 56;
export const BUBBLE_WIDTH = 56;
export const BUBBLE_MARGIN = 16;

/** 根据屏幕高度动态计算聊天窗口高度（55%，限制 320~600） */
export function getChatHeight(screenHeight: number): number {
  return Math.min(600, Math.max(320, Math.round(screenHeight * 0.55)));
}

/** 默认位置：右下角 */
export const DEFAULT_POSITION = {
  x: SCREEN_WIDTH - BUBBLE_WIDTH - BUBBLE_MARGIN,
  y: SCREEN_HEIGHT - BUBBLE_HEIGHT - 60,
};

// ── DisplayMessage 类型 ─────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── Factory ──────────────────────────────────────────────

export const createStyles = (colors: ThemeColors) => ({
  ...createBubbleStyles(colors, BUBBLE_HEIGHT, BUBBLE_WIDTH),
  ...createChatStyles(colors, CHAT_WIDTH),
});

export type ChatStyles = ReturnType<typeof createStyles>;
