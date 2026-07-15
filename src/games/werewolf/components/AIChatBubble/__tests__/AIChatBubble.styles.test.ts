import {
  BUBBLE_HORIZONTAL_MARGIN,
  BUBBLE_PULSE_MAX_SCALE,
  BUBBLE_PULSE_OVERHANG,
  BUBBLE_WIDTH,
  getDefaultPosition,
} from '../AIChatBubble.styles';

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
});
