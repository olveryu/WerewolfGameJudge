/**
 * gradient — Canvas 2D 渐变绘制工具
 *
 * 提供径向渐变、线性渐变的便捷绘制函数。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

/** Draw a filled circle with radial gradient */
export function fillRadialGradientCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  colorStops: Array<[number, string]>,
): void {
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  for (const [offset, color] of colorStops) {
    grad.addColorStop(offset, color);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/** Draw a rectangle with linear gradient fill */
export function fillLinearGradientRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colorStops: Array<[number, string]>,
): void {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of colorStops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/** Fill full canvas area with a radial gradient */
export function fillRadialGradientRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  w: number,
  h: number,
  colorStops: Array<[number, string]>,
): void {
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  for (const [offset, color] of colorStops) {
    grad.addColorStop(offset, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Create a radial gradient and return it (for reuse) */
export function createRadialGrad(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  colorStops: Array<[number, string]>,
): CanvasGradient {
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  for (const [offset, color] of colorStops) {
    grad.addColorStop(offset, color);
  }
  return grad;
}
