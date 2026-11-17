import { describe, expect, it } from 'vitest';

import { SPOTMATCH_SYMBOLS, spotmatchSymbolLayout } from '../symbols';

describe('approved Spotmatch artwork and constrained layouts', () => {
  it('resolves all 200 unique approved SVGs at build time with accessible names', () => {
    expect(SPOTMATCH_SYMBOLS).toHaveLength(200);
    expect(new Set(SPOTMATCH_SYMBOLS.map((symbol) => symbol.id)).size).toBe(200);
    expect(
      SPOTMATCH_SYMBOLS.every(
        (symbol) =>
          symbol.name.length > 0 &&
          (/\.svg/.test(symbol.url) || symbol.url.startsWith('data:image/svg+xml')),
      ),
    ).toBe(true);
  });
  it('returns the same layout for the same seed', () => {
    for (const seed of [0, 1, 42, 999]) {
      expect(spotmatchSymbolLayout(seed)).toEqual(spotmatchSymbolLayout(seed));
    }
  });
  it('keeps scattered targets separated and inside cards at mobile and maximum widths', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const layout = spotmatchSymbolLayout(seed);
      expect(layout).toHaveLength(8);
      const heights = layout.map(({ y }) => y).sort((a, b) => a - b);
      const verticalSpacingValid = heights.every((height, index) => {
        const fourth = heights[index + 3];
        return fourth === undefined || fourth - height >= 22;
      });
      expect(verticalSpacingValid, `seed ${seed} has crowded vertical targets`).toBe(true);
      for (const [index, target] of layout.entries()) {
        const angle = (Math.abs(target.rotation) * Math.PI) / 180;
        expect((target.scale / 100) * (Math.cos(angle) + Math.sin(angle))).toBeLessThan(1);
        for (const width of [288, 343, 358, 420]) {
          const innerWidth = width - 6;
          const innerHeight = (width * 4) / 7 - 6;
          const size = Math.max(52, Math.min(60, innerWidth * 0.18));
          const x = (innerWidth * target.x) / 100;
          const y = (innerHeight * target.y) / 100;
          const insideCard =
            x - size / 2 >= 0 &&
            x + size / 2 <= innerWidth &&
            y - size / 2 >= 0 &&
            y + size / 2 <= innerHeight;
          const separatedFromOtherTargets = layout.slice(index + 1).every((other) => {
            const dx = (Math.abs(target.x - other.x) * innerWidth) / 100;
            const dy = (Math.abs(target.y - other.y) * innerHeight) / 100;
            return dx >= size || dy >= size;
          });
          expect(
            insideCard && separatedFromOtherTargets,
            `seed ${seed}, target ${index}, width ${width} violates card constraints`,
          ).toBe(true);
        }
      }
    }
    const layouts = Array.from({ length: 100 }, (_, seed) =>
      spotmatchSymbolLayout(seed)
        .map(({ x, y }) => `${x.toFixed(2)}:${y.toFixed(2)}`)
        .sort()
        .join(';'),
    );
    expect(new Set(layouts).size).toBe(100);
  });
});
