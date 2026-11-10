/** Connected-region fill contracts independent of the Skia rasterizer. */

import { createFillRectangles, type PixelColor } from '../floodFill';

const WHITE: PixelColor = [255, 255, 255, 255];
const BLACK: PixelColor = [0, 0, 0, 255];

function pixelsFromRows(rows: readonly (readonly PixelColor[])[]): Uint8Array {
  return Uint8Array.from(rows.flatMap((row) => row.flatMap((color) => [...color])));
}

describe('createFillRectangles', () => {
  it('fills only the four-connected region on the selected side of a boundary', () => {
    const pixels = pixelsFromRows([
      [WHITE, WHITE, BLACK, WHITE, WHITE],
      [WHITE, WHITE, BLACK, WHITE, WHITE],
      [WHITE, WHITE, BLACK, WHITE, WHITE],
    ]);

    expect(createFillRectangles(pixels, 5, 3, 0, WHITE)).toEqual([
      { x: 0, y: 0, width: 2, height: 3 },
    ]);
  });

  it('does not include a diagonally connected pixel', () => {
    const pixels = pixelsFromRows([
      [WHITE, BLACK],
      [BLACK, WHITE],
    ]);

    expect(createFillRectangles(pixels, 2, 2, 0, WHITE)).toEqual([
      { x: 0, y: 0, width: 1, height: 1 },
    ]);
  });
});
