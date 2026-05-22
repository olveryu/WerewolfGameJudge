/**
 * shapes — Canvas 2D 基础形状绘制工具
 *
 * 提供 circle、roundRect、line 等基本图形的命令式绘制函数。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

/** Draw a filled circle */
export function fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draw a stroked circle */
export function strokeCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Draw a filled arc (pie slice) */
export function fillArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draw a filled rounded rectangle (uses native roundRect or fallback) */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draw a stroked rounded rectangle */
export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Draw a line between two points */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  cap: CanvasLineCap = 'butt',
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = cap;
  ctx.stroke();
}

/** Draw a filled oval (ellipse) */
export function fillOval(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Internal: trace a rounded rect path (compatible with all browsers) */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
