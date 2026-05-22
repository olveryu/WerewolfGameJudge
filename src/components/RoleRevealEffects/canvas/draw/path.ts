/**
 * path — Canvas 2D 路径绘制工具
 *
 * 提供 SVG path 绘制、多边形、裂纹路径等工具函数。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

/** Draw a filled SVG path string */
export function fillSvgPath(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  color: string,
  tx: number = 0,
  ty: number = 0,
): void {
  ctx.save();
  ctx.translate(tx, ty);
  const path = new Path2D(pathData);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}

/** Draw a stroked SVG path string */
export function strokeSvgPath(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  color: string,
  lineWidth: number,
  tx: number = 0,
  ty: number = 0,
  lineCap: CanvasLineCap = 'round',
): void {
  ctx.save();
  ctx.translate(tx, ty);
  const path = new Path2D(pathData);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = lineCap;
  ctx.stroke(path);
  ctx.restore();
}

/** Draw a stroked polyline (array of [x, y] points) */
export function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<[number, number]>,
  color: string,
  lineWidth: number,
  cap: CanvasLineCap = 'round',
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = cap;
  ctx.stroke();
}

/** Draw a stroked polyline with dash offset animation (for crack spreading) */
export function strokeAnimatedPath(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<[number, number]>,
  color: string,
  lineWidth: number,
  progress: number,
): void {
  if (points.length < 2 || progress <= 0) return;

  // Calculate total length
  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]![0] - points[i - 1]![0];
    const dy = points[i]![1] - points[i - 1]![1];
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  const drawLen = totalLen * Math.min(progress, 1);
  let accumulated = 0;

  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);

  for (let i = 1; i < points.length; i++) {
    const dx = points[i]![0] - points[i - 1]![0];
    const dy = points[i]![1] - points[i - 1]![1];
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segLen <= drawLen) {
      ctx.lineTo(points[i]![0], points[i]![1]);
      accumulated += segLen;
    } else {
      const remaining = drawLen - accumulated;
      const ratio = remaining / segLen;
      ctx.lineTo(points[i - 1]![0] + dx * ratio, points[i - 1]![1] + dy * ratio);
      break;
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Draw a polygon from vertices (filled) */
export function fillPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<[number, number]>,
  color: string,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(vertices[0]![0], vertices[0]![1]);
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(vertices[i]![0], vertices[i]![1]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
