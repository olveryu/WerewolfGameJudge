/**
 * blur — Canvas 2D 模糊效果工具
 *
 * 封装 ctx.filter blur 设置、shadowBlur 模拟。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

/** Execute a draw callback with blur filter applied, then restore */
export function withBlur(
  ctx: CanvasRenderingContext2D,
  blurPx: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const prev = ctx.filter;
  ctx.filter = `blur(${blurPx}px)`;
  draw(ctx);
  ctx.filter = prev;
}

/** Execute a draw callback with globalAlpha set, then restore */
export function withOpacity(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  draw(ctx);
  ctx.globalAlpha = prev;
}

/** Execute a draw callback with compositeOperation set, then restore */
export function withBlendMode(
  ctx: CanvasRenderingContext2D,
  mode: GlobalCompositeOperation,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = mode;
  draw(ctx);
  ctx.globalCompositeOperation = prev;
}

/** Execute a draw callback with both blur and opacity, then restore */
export function withBlurAndOpacity(
  ctx: CanvasRenderingContext2D,
  blurPx: number,
  alpha: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  const prevFilter = ctx.filter;
  const prevAlpha = ctx.globalAlpha;
  ctx.filter = `blur(${blurPx}px)`;
  ctx.globalAlpha = alpha;
  draw(ctx);
  ctx.filter = prevFilter;
  ctx.globalAlpha = prevAlpha;
}

/** Draw a glow effect (circle with blur) at a position */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  blurPx: number,
  opacity: number,
): void {
  if (opacity <= 0.01) return;
  const prevFilter = ctx.filter;
  const prevAlpha = ctx.globalAlpha;
  ctx.filter = `blur(${blurPx}px)`;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.filter = prevFilter;
  ctx.globalAlpha = prevAlpha;
}
