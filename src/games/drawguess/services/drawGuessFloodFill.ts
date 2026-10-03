/**
 * 纯四连通像素区域搜索与矩形压缩，供填充桶工具使用。
 *
 * 从接龙版 `src/games/pictionary/services/pictionaryFloodFill.ts` 复制并改名（游戏间禁止互相 import）。
 */

import type { DrawGuessDrawingFillRectangle } from '../model/drawGuessDrawing';

export type DrawGuessPixelColor = readonly [number, number, number, number];

function hasPixelColor(
  pixels: Uint8Array,
  pixelIndex: number,
  color: DrawGuessPixelColor,
): boolean {
  const offset = pixelIndex * 4;
  return (
    pixels[offset] === color[0] &&
    pixels[offset + 1] === color[1] &&
    pixels[offset + 2] === color[2] &&
    pixels[offset + 3] === color[3]
  );
}

function compressFillMask(
  mask: Uint8Array,
  width: number,
  height: number,
): readonly DrawGuessDrawingFillRectangle[] {
  const rectangles: Array<{ x: number; y: number; width: number; height: number }> = [];
  let previousRuns = new Map<string, number>();
  for (let y = 0; y < height; y += 1) {
    const currentRuns = new Map<string, number>();
    let x = 0;
    while (x < width) {
      if (mask[y * width + x] !== 1) {
        x += 1;
        continue;
      }
      const startX = x;
      while (x < width && mask[y * width + x] === 1) x += 1;
      const runWidth = x - startX;
      const key = `${startX}:${runWidth}`;
      const previousRectangleIndex = previousRuns.get(key);
      if (previousRectangleIndex === undefined) {
        currentRuns.set(key, rectangles.length);
        rectangles.push({ x: startX, y, width: runWidth, height: 1 });
      } else {
        const previousRectangle = rectangles[previousRectangleIndex];
        if (previousRectangle === undefined) {
          throw new Error('[FAIL-FAST] DrawGuess fill rectangle index is invalid');
        }
        previousRectangle.height += 1;
        currentRuns.set(key, previousRectangleIndex);
      }
    }
    previousRuns = currentRuns;
  }
  return rectangles;
}

/** 找到包含种子像素的精确颜色四连通区域。 */
export function createDrawGuessFillRectangles(
  pixels: Uint8Array,
  width: number,
  height: number,
  seedIndex: number,
  targetColor: DrawGuessPixelColor,
): readonly DrawGuessDrawingFillRectangle[] {
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.length !== pixelCount * 4 ||
    !Number.isSafeInteger(seedIndex) ||
    seedIndex < 0 ||
    seedIndex >= pixelCount ||
    !hasPixelColor(pixels, seedIndex, targetColor)
  ) {
    throw new Error('[FAIL-FAST] DrawGuess flood-fill input is invalid');
  }

  const visited = new Uint8Array(pixelCount);
  const mask = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  let stackSize = 1;
  stack[0] = seedIndex;
  visited[seedIndex] = 1;

  const enqueue = (neighbor: number): void => {
    if (visited[neighbor] === 1) return;
    visited[neighbor] = 1;
    if (!hasPixelColor(pixels, neighbor, targetColor)) return;
    stack[stackSize] = neighbor;
    stackSize += 1;
  };

  while (stackSize > 0) {
    stackSize -= 1;
    const pixelIndex = stack[stackSize]!;
    mask[pixelIndex] = 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y + 1 < height) enqueue(pixelIndex + width);
  }

  return compressFillMask(mask, width, height);
}
