/** AI chat bubble geometry: bubble size, pulse overhang and the default and clamped positions. */

export const BUBBLE_HEIGHT = 56;
export const BUBBLE_WIDTH = 56;
export const BUBBLE_MARGIN = 16;
export const BUBBLE_PULSE_MAX_SCALE = 1.8;
export const BUBBLE_PULSE_OVERHANG = (BUBBLE_WIDTH * (BUBBLE_PULSE_MAX_SCALE - 1)) / 2;
export const BUBBLE_HORIZONTAL_MARGIN = Math.ceil(Math.max(BUBBLE_MARGIN, BUBBLE_PULSE_OVERHANG));
/** Keeps the bubble clear of the page header. */
const BUBBLE_TOP_INSET = BUBBLE_MARGIN + 50;
/**
 * Height the room hand can reach above the viewport bottom, mirrored from tokens.css and
 * RoomActionHand.css: top padding (--space-medium) + visible card (--size-hand-card-visible)
 * + bottom padding (--space-small plus the fan drop), then a hovered or focused card's raise
 * (--space-medium) and the 「待行动」 badge above it (--line-caption).
 */
export const ROOM_HAND_REACH = 16 + 120 + 16 + 16 + 16;
/** The default spot sits a margin above the hand so the bubble never covers or hides behind it. */
const DEFAULT_BOTTOM_INSET = ROOM_HAND_REACH + BUBBLE_MARGIN;

export interface BubblePosition {
  readonly x: number;
  readonly y: number;
}

export interface BubbleViewport {
  readonly width: number;
  readonly height: number;
}

/** Default bubble position (bottom right) for the given viewport. */
export function getDefaultPosition(screenWidth: number, screenHeight: number): BubblePosition {
  return {
    x: screenWidth - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN,
    y: screenHeight - BUBBLE_HEIGHT - DEFAULT_BOTTOM_INSET,
  };
}

/** Keeps the bubble (and its pulse ring) inside the viewport. */
export function clampBubblePosition(
  position: BubblePosition,
  viewport: BubbleViewport,
): BubblePosition {
  return {
    x: Math.max(
      BUBBLE_HORIZONTAL_MARGIN,
      Math.min(viewport.width - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN, position.x),
    ),
    y: Math.max(
      BUBBLE_TOP_INSET,
      Math.min(viewport.height - BUBBLE_HEIGHT - BUBBLE_MARGIN, position.y),
    ),
  };
}
