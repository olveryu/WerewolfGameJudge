/**
 * createCanvasLoop — 核心 rAF 循环工具
 *
 * 创建一个 requestAnimationFrame 循环，每帧调用 draw 回调。
 * 处理 DPI 缩放和 canvas 尺寸设置。
 * 纯 Web API，不依赖 React Native。
 */

interface CanvasLoopOptions {
  /** Canvas element to draw on */
  canvas: HTMLCanvasElement;
  /** Logical width (CSS pixels) */
  width: number;
  /** Logical height (CSS pixels) */
  height: number;
  /** Draw callback, receives 2D context and elapsed time (ms since start) */
  draw: (ctx: CanvasRenderingContext2D, elapsed: number) => void;
}

/**
 * Initializes a canvas with DPI scaling and starts a rAF loop.
 * Returns a cleanup function that stops the loop.
 */
export function createCanvasLoop({ canvas, width, height, draw }: CanvasLoopOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context');

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const startTime = performance.now();
  let rafId = 0;

  function frame() {
    const elapsed = performance.now() - startTime;
    ctx!.clearRect(0, 0, width, height);
    draw(ctx!, elapsed);
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}
