/**
 * easing — 缓动函数集合
 *
 * 提供常用的 easing 函数，用于 Canvas 2D 动画插值。
 * 替代 Reanimated 的 Easing 模块用于 canvas 内部动画。
 */

/** Linear (no easing) */
export function linear(t: number): number {
  return t;
}

/** Ease out quad */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Ease in quad */
export function easeInQuad(t: number): number {
  return t * t;
}

/** Ease in-out quad */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Ease out cubic */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Ease in cubic */
export function easeInCubic(t: number): number {
  return t ** 3;
}

/** Ease in-out cubic */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Ease out back (overshoot) */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Ease out elastic */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

/** Ease in-out sine */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Clamp value between 0 and 1, then apply easing */
export function clampedEase(t: number, easeFn: (t: number) => number): number {
  return easeFn(Math.max(0, Math.min(1, t)));
}

/** Interpolate between two values */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate with keyframes: given input t in [0,1], map through input→output pairs */
export function interpolateKeyframes(
  t: number,
  inputs: readonly number[],
  outputs: readonly number[],
): number {
  if (t <= inputs[0]!) return outputs[0]!;
  if (t >= inputs[inputs.length - 1]!) return outputs[outputs.length - 1]!;

  for (let i = 0; i < inputs.length - 1; i++) {
    if (t >= inputs[i]! && t <= inputs[i + 1]!) {
      const localT = (t - inputs[i]!) / (inputs[i + 1]! - inputs[i]!);
      return outputs[i]! + (outputs[i + 1]! - outputs[i]!) * localT;
    }
  }
  return outputs[outputs.length - 1]!;
}
