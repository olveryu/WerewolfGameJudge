/**
 * easing — 缓动函数集合
 *
 * 用于 Canvas 2D DOM 组件动画插值。
 */

/** Ease out quad */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
