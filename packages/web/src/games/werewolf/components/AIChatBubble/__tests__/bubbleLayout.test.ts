import {
  BUBBLE_HEIGHT,
  BUBBLE_HORIZONTAL_MARGIN,
  BUBBLE_MARGIN,
  BUBBLE_PULSE_MAX_SCALE,
  BUBBLE_PULSE_OVERHANG,
  BUBBLE_WIDTH,
  clampBubblePosition,
  getDefaultPosition,
} from '../bubbleLayout';

describe('AIChatBubble layout', () => {
  it('keeps the maximum pulse ring inside a narrow viewport', () => {
    const viewportWidth = 320;
    const position = getDefaultPosition(viewportWidth, 640);

    expect(BUBBLE_HORIZONTAL_MARGIN).toBeGreaterThanOrEqual(BUBBLE_PULSE_OVERHANG);
    expect(position.x - BUBBLE_PULSE_OVERHANG).toBeGreaterThanOrEqual(0);
    expect(position.x + BUBBLE_WIDTH + BUBBLE_PULSE_OVERHANG).toBeLessThanOrEqual(viewportWidth);
  });

  it('derives pulse overhang from the same scale used by the animation', () => {
    expect(BUBBLE_PULSE_MAX_SCALE).toBe(1.8);
    expect(BUBBLE_PULSE_OVERHANG).toBe((BUBBLE_WIDTH * (BUBBLE_PULSE_MAX_SCALE - 1)) / 2);
  });

  it('clamps a saved position from a larger viewport back on screen', () => {
    const clamped = clampBubblePosition({ x: 900, y: 2000 }, { width: 320, height: 640 });

    expect(clamped).toEqual({
      x: 320 - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN,
      y: 640 - BUBBLE_HEIGHT - BUBBLE_MARGIN,
    });
  });
});
