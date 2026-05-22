/**
 * Shared Canvas drawing utilities for seat flairs.
 *
 * Pure math helpers used by draw functions — no React/RN dependencies.
 */

/** Draw a filled circle at (x, y) with radius r. */
export function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Stroke a circle at (x, y) with radius r. */
export function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draw an SVG path string using Path2D. */
export function fillPath(ctx: CanvasRenderingContext2D, d: string): void {
  const p = new Path2D(d);
  ctx.fill(p);
}

/** Stroke an SVG path string using Path2D. */
export function strokePath(ctx: CanvasRenderingContext2D, d: string): void {
  const p = new Path2D(d);
  ctx.stroke(p);
}

/** Draw a line from (x1,y1) to (x2,y2). */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * LegendaryAura draw — breathing center glow + hue-shifting orbit ring.
 * Used by legendary flairs as first draw layer.
 */
export function drawLegendaryAura(
  ctx: CanvasRenderingContext2D,
  size: number,
  progress: number,
  r: number,
  g: number,
  b: number,
  orbit = 0.38,
): void {
  const cx = size / 2;
  const cy = size / 2;

  // Breathing center glow
  const breathe = 0.03 + 0.07 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
  ctx.globalAlpha = breathe;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  fillCircle(ctx, cx, cy, size * 0.35);

  // Hue-shifting orbit ring
  const ringBreath = 0.05 + 0.07 * (0.5 + 0.5 * Math.cos(progress * Math.PI * 2 + 1));
  const shift = Math.sin(progress * Math.PI * 2) * 20;
  const nr = Math.max(0, Math.min(255, Math.round(r + shift)));
  const nb = Math.max(0, Math.min(255, Math.round(b - shift)));
  ctx.globalAlpha = ringBreath;
  ctx.strokeStyle = `rgb(${nr},${g},${nb})`;
  ctx.lineWidth = size * 0.015;
  strokeCircle(ctx, cx, cy, orbit * size);
}
