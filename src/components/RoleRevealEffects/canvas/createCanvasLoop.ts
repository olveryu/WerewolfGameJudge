/**
 * createCanvasLoop — 核心 rAF 循环工具
 *
 * 创建一个 requestAnimationFrame 循环，每帧调用 draw 回调。
 * 处理 DPI 缩放和 canvas 尺寸设置。
 *
 * 停止条件（满足任一即停）：
 * 1. `duration` 到期 — elapsed > duration 时停止调度。
 * 2. `draw` 返回 `false` — 显式声明动画完成。
 * 3. cleanup 函数被调用（组件卸载）。
 *
 * 纯 Web API，不依赖 React Native。
 */

interface CanvasLoopOptions {
  /** Canvas element to draw on */
  canvas: HTMLCanvasElement;
  /** Logical width (CSS pixels) */
  width: number;
  /** Logical height (CSS pixels) */
  height: number;
  /**
   * Draw callback. Receives 2D context and elapsed time (ms since start).
   * Return `false` to stop the loop immediately.
   */
  draw: (ctx: CanvasRenderingContext2D, elapsed: number) => void | false;
  /**
   * Maximum duration (ms). When elapsed exceeds this, the loop stops.
   * Omit for infinite animations (rely on cleanup or draw returning false).
   */
  duration?: number;
}

/**
 * Initializes a canvas with DPI scaling and starts a rAF loop.
 * Returns a cleanup function that stops the loop.
 */
export function createCanvasLoop({
  canvas,
  width,
  height,
  draw,
  duration,
}: CanvasLoopOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context');

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const startTime = performance.now();
  let rafId = 0;
  let stopped = false;

  function frame() {
    if (stopped) return;
    const elapsed = performance.now() - startTime;
    if (duration !== undefined && elapsed > duration) {
      stopped = true;
      return;
    }
    ctx!.clearRect(0, 0, width, height);
    const result = draw(ctx!, elapsed);
    if (result === false) {
      stopped = true;
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
