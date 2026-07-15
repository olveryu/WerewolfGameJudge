/**
 * AIChatBubble.styles — barrel file.
 *
 * Composes per-group style creators into a single flat ChatStyles object.
 * Owns layout constants and shared types consumed by sibling modules.
 * Does not contain style definitions — those live in bubble/chat sub-files.
 */

import type { ThemeColors } from '@/theme';

import { createBubbleStyles } from './bubble.styles';
import { createChatStyles } from './chat.styles';

// ── Layout constants ─────────────────────────────────────

/** Compute chat window width from current screen width */
function getChatWidth(screenWidth: number): number {
  return Math.min(screenWidth - 32, 380);
}

/** Badge dimensions (vertical: icon + label) */
export const BUBBLE_HEIGHT = 56;
export const BUBBLE_WIDTH = 56;
export const BUBBLE_MARGIN = 16;
export const BUBBLE_PULSE_MAX_SCALE = 1.8;
export const BUBBLE_PULSE_OVERHANG = (BUBBLE_WIDTH * (BUBBLE_PULSE_MAX_SCALE - 1)) / 2;
export const BUBBLE_HORIZONTAL_MARGIN = Math.ceil(Math.max(BUBBLE_MARGIN, BUBBLE_PULSE_OVERHANG));

/** Dynamically compute chat window height based on screen height (55%, clamped to 320–600). */
export function getChatHeight(screenHeight: number): number {
  return Math.min(600, Math.max(320, Math.round(screenHeight * 0.55)));
}

/** Compute default bubble position for given screen dimensions */
export function getDefaultPosition(screenWidth: number, screenHeight: number) {
  return {
    x: screenWidth - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN,
    y: screenHeight - BUBBLE_HEIGHT - 60,
  };
}

// ── DisplayMessage type ─────────────────────────────────

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ── Factory ──────────────────────────────────────────────

export const createStyles = (colors: ThemeColors, screenWidth: number) => ({
  ...createBubbleStyles(colors, BUBBLE_HEIGHT, BUBBLE_WIDTH),
  ...createChatStyles(colors, getChatWidth(screenWidth)),
});
