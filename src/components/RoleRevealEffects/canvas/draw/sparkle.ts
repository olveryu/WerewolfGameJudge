/**
 * sparkle — Canvas 2D 十字闪烁星形绘制
 *
 * 替代 SkiaSparkle 组件。渲染一个 ✦ 形 sparkle：中心亮点 + 十字线 + 柔光晕。
 * 纯 Web Canvas 2D API，不依赖 React Native。
 */

export interface SparkleOptions {
  /** Center X */
  x: number;
  /** Center Y */
  y: number;
  /** Base radius */
  r: number;
  /** Spike / dot color */
  color: string;
  /** Glow halo color (defaults to color) */
  glowColor?: string;
  /** 8-pointed? (with diagonal spikes) */
  bright?: boolean;
  /** Blur radius for glow halo */
  glowBlur?: number;
  /** Stroke width multiplier */
  strokeScale?: number;
  /** Overall opacity */
  opacity?: number;
}

/** Draw a sparkle shape at the given position */
export function drawSparkle(ctx: CanvasRenderingContext2D, opts: SparkleOptions): void {
  const {
    x,
    y,
    r,
    color,
    glowColor,
    bright = false,
    glowBlur = 4,
    strokeScale = 1,
    opacity = 1,
  } = opts;
  if (opacity <= 0.01) return;

  const gc = glowColor ?? color;
  const vLen = r * 3.5;
  const hLen = r * 2.5;
  const dLen = r * 2;
  const sw = (bright ? 1.2 : 0.8) * strokeScale;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Soft glow halo
  const prevFilter = ctx.filter;
  ctx.filter = `blur(${glowBlur}px)`;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fillStyle = gc;
  ctx.fill();
  ctx.filter = prevFilter;

  // Vertical spike
  ctx.beginPath();
  ctx.moveTo(x, y - vLen);
  ctx.lineTo(x, y + vLen);
  ctx.strokeStyle = color;
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Horizontal spike
  ctx.beginPath();
  ctx.moveTo(x - hLen, y);
  ctx.lineTo(x + hLen, y);
  ctx.stroke();

  // Diagonal spikes for 8-pointed ✦
  if (bright) {
    ctx.lineWidth = sw * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - dLen, y - dLen);
    ctx.lineTo(x + dLen, y + dLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dLen, y - dLen);
    ctx.lineTo(x - dLen, y + dLen);
    ctx.stroke();
  }

  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}
