/** Shared Canvas 2D drawing helpers for animation overlays */

export function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
}

export function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
}

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

export function triangle(ctx: CanvasRenderingContext2D, x: number, y: number, half: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.lineTo(x + half * 0.7, y + half * 0.5);
  ctx.lineTo(x - half * 0.7, y + half * 0.5);
  ctx.closePath();
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Clamp between 0 and 1 */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Map a sub-range of [start, end] within [0,1] to [0,1] */
export function phase(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}
