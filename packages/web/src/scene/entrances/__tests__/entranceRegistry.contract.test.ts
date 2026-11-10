/**
 * Contract: every reward-catalog seat animation loads an entrance spec under its own id that
 * draws at every moment of its play (path data parses, geometry is finite), completes before it
 * settles, and leaves the plain avatar behind once settled.
 */
import { SEAT_ANIMATION_IDS } from '@game-judge/game-engine/product/rewards';
import { GraphicsContext } from 'pixi.js';

import type { EntranceLayer } from '@/scene/entrance';
import { loadEntranceSpec } from '@/scene/entrances/registry';

/** The seat tile's border box on a 390 px phone. */
const TILE_SIZE = 76.5;
const STEP_MS = 50;

function drawLayer(layer: EntranceLayer, ms: number): void {
  const context = new GraphicsContext();
  if (typeof layer === 'function') {
    layer(context, ms, TILE_SIZE);
  } else {
    expect(Number.isFinite(layer.groupOpacity(ms))).toBe(true);
    layer.draw(context, ms, TILE_SIZE);
  }
  context.destroy();
}

describe('seat entrance registry', () => {
  it.each([...SEAT_ANIMATION_IDS])('%s plays from start to settle', async (id) => {
    const spec = await loadEntranceSpec(id);
    expect(spec.id).toBe(id);
    expect(spec.completeMs).toBeGreaterThan(0);
    expect(spec.settleMs).toBeGreaterThanOrEqual(spec.completeMs);
    for (let ms = 0; ms <= spec.completeMs + STEP_MS; ms += STEP_MS) {
      for (const pose of spec.avatar(ms, TILE_SIZE)) {
        for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true);
      }
      if (spec.beneath) drawLayer(spec.beneath, ms);
      if (spec.above) drawLayer(spec.above, ms);
    }
    const settled = spec.avatar(spec.settleMs, TILE_SIZE).at(-1);
    expect(settled).toBeDefined();
    const { opacity, translateX, translateY, scale, rotateDeg, rotateYDeg, clipTop, clipRight } =
      settled!;
    expect([opacity, scale, clipTop, clipRight]).toEqual([1, expect.any(Number), 0, 0]);
    for (const value of [translateX, translateY, rotateDeg, rotateYDeg]) {
      expect(value).toBeCloseTo(0, 6);
    }
    expect(scale).toBeCloseTo(1, 6);
  });
});
