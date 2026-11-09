import type { Graphics } from 'pixi.js';

interface SparkleStyle {
  readonly color: string;
  readonly alpha: number;
  readonly glowColor?: string;
  /** Adds the diagonal spikes of the 8-pointed ✦. */
  readonly bright?: boolean;
  readonly strokeScale?: number;
}

/**
 * The old `SkiaSparkle`: a soft halo (into `halo`, a blurred layer) under a 4- or 8-pointed spike
 * star with a bright center dot (into `spikes`).
 */
export function drawSparkle(
  halo: Graphics,
  spikes: Graphics,
  x: number,
  y: number,
  r: number,
  { color, alpha, glowColor = color, bright = false, strokeScale = 1 }: SparkleStyle,
): void {
  const vertical = r * 3.5;
  const horizontal = r * 2.5;
  const diagonal = r * 2;
  const width = (bright ? 1.2 : 0.8) * strokeScale;
  halo.circle(x, y, r * 4).fill({ color: glowColor, alpha });
  spikes
    .moveTo(x, y - vertical)
    .lineTo(x, y + vertical)
    .moveTo(x - horizontal, y)
    .lineTo(x + horizontal, y)
    .stroke({ color, alpha, width, cap: 'round' });
  if (bright) {
    spikes
      .moveTo(x - diagonal, y - diagonal)
      .lineTo(x + diagonal, y + diagonal)
      .moveTo(x + diagonal, y - diagonal)
      .lineTo(x - diagonal, y + diagonal)
      .stroke({ color, alpha, width: width * 0.6, cap: 'round' });
  }
  spikes.circle(x, y, r * 0.5).fill({ color, alpha });
}
