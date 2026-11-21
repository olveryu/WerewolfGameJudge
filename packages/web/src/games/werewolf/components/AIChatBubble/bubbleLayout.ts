/** AI chat bubble geometry: bubble size, pulse overhang and the default and clamped positions. */

export const BUBBLE_HEIGHT = 56;
export const BUBBLE_WIDTH = 56;
export const BUBBLE_MARGIN = 16;
export const BUBBLE_PULSE_MAX_SCALE = 1.8;
export const BUBBLE_PULSE_OVERHANG = (BUBBLE_WIDTH * (BUBBLE_PULSE_MAX_SCALE - 1)) / 2;
export const BUBBLE_HORIZONTAL_MARGIN = Math.ceil(Math.max(BUBBLE_MARGIN, BUBBLE_PULSE_OVERHANG));
/** Keeps the bubble clear of the page header. */
const BUBBLE_TOP_INSET = BUBBLE_MARGIN + 50;

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
    y: screenHeight - BUBBLE_HEIGHT - 60,
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
