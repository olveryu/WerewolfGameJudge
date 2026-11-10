/**
 * One-shot timelines with the semantics of the React Native client's Reanimated 4 animations
 * (`withTiming`, `withSpring`, `withDelay`, `withSequence` and `Easing`), as pure functions of
 * the time since the animation started. Reanimated advanced them frame by frame with exact
 * per-step solutions, so sampling the closed form at any time gives the same values; only the
 * frame quantisation of delays and sequence hand-overs is not reproduced.
 */

export type EasingFunction = (t: number) => number;

function linear(t: number): number {
  return t;
}

function quad(t: number): number {
  return t * t;
}

function cubic(t: number): number {
  return t * t * t;
}

/** Overshooting ease (Reanimated `Easing.back`, default overshoot 1.70158). */
function back(s = 1.70158): EasingFunction {
  return (t) => t * t * ((s + 1) * t - s);
}

/** Reanimated `Easing.sin`. */
function sin(t: number): number {
  return 1 - Math.cos((t * Math.PI) / 2);
}

/** Reanimated `Easing.bounce`: a ball dropped onto the end value. */
function bounce(t: number): number {
  const strength = 7.5625;
  if (t < 1 / 2.75) return strength * t * t;
  if (t < 2 / 2.75) return strength * (t - 1.5 / 2.75) ** 2 + 0.75;
  if (t < 2.5 / 2.75) return strength * (t - 2.25 / 2.75) ** 2 + 0.9375;
  return strength * (t - 2.625 / 2.75) ** 2 + 0.984375;
}

function easeIn(easing: EasingFunction): EasingFunction {
  return easing;
}

/** Runs an easing backwards. */
function easeOut(easing: EasingFunction): EasingFunction {
  return (t) => 1 - easing(1 - t);
}

/** Symmetric in-out version of an easing. */
function easeInOut(easing: EasingFunction): EasingFunction {
  return (t) => (t < 0.5 ? easing(t * 2) / 2 : 1 - easing((1 - t) * 2) / 2);
}

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)`: solves the curve's x for the time, then returns its y
 * (Newton's method with a bisection fallback, as browsers do).
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const curveX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const curveY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  const solveU = (x: number): number => {
    let u = x;
    for (let i = 0; i < 8; i += 1) {
      const error = curveX(u) - x;
      if (Math.abs(error) < 1e-7) return u;
      const slope = slopeX(u);
      if (Math.abs(slope) < 1e-6) break;
      u -= error / slope;
    }
    let low = 0;
    let high = 1;
    u = x;
    while (high - low > 1e-7) {
      if (curveX(u) < x) low = u;
      else high = u;
      u = (low + high) / 2;
    }
    return u;
  };
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : curveY(solveU(t)));
}

/** Reanimated's `Easing` functions used by the seat and reveal animations. */
export const Easing = {
  linear,
  quad,
  cubic,
  sin,
  back,
  bounce,
  bezier: cubicBezier,
  in: easeIn,
  out: easeOut,
  inOut: easeInOut,
};

/** CSS `ease-in-out`. */
export const CSS_EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);

/** An animation of one value, started from whatever value it holds at its start. */
export interface Animation {
  /** The value it finishes on. */
  readonly toValue: number;
  /** Milliseconds from its start until it finishes when started from `from`. */
  durationFrom(from: number): number;
  /** Its value `elapsedMs` after starting from `from`. */
  valueAt(from: number, elapsedMs: number): number;
}

interface TimingConfig {
  /** Defaults to 300 ms, as in Reanimated. */
  duration?: number;
  /** Defaults to `Easing.inOut(Easing.quad)`, as in Reanimated. */
  easing?: EasingFunction;
}

/** `withTiming(toValue, config)`. */
export function withTiming(toValue: number, config: TimingConfig = {}): Animation {
  const duration = config.duration ?? 300;
  const easing = config.easing ?? easeInOut(quad);
  return {
    toValue,
    durationFrom: () => duration,
    valueAt: (from, elapsedMs) =>
      elapsedMs >= duration ? toValue : from + (toValue - from) * easing(elapsedMs / duration),
  };
}

/** The `withSpring` options the seat animations use: physics or duration-based. */
export interface SpringConfig {
  damping?: number;
  stiffness?: number;
  mass?: number;
  /** Perceptual duration in ms; with it (or `dampingRatio`) the stiffness is derived. */
  duration?: number;
  dampingRatio?: number;
}

/** Reanimated 4 defaults (`GentleSpringConfig` + `GentleSpringConfigWithDuration`). */
const SPRING_DEFAULTS = {
  damping: 120,
  mass: 4,
  stiffness: 900,
  duration: 550,
  dampingRatio: 1,
  energyThreshold: 6e-9,
} as const;

interface SpringMotion {
  zeta: number;
  omega0: number;
  omega1: number;
  stiffness: number;
  mass: number;
  energyThreshold: number;
}

function energy(displacement: number, velocity: number, stiffness: number, mass: number): number {
  return 0.5 * stiffness * displacement ** 2 + 0.5 * mass * velocity ** 2;
}

/** Reanimated's `bisectRoot`. */
function bisectRoot(min: number, max: number, func: (x: number) => number, precision: number) {
  const direction = func(max) >= func(min) ? 1 : -1;
  let remaining = 100;
  let current = (max + min) / 2;
  while (Math.abs(func(current)) > precision && remaining > 0) {
    remaining -= 1;
    if (func(current) * direction < 0) min = current;
    else max = current;
    current = (min + max) / 2;
  }
  return current;
}

/** Reanimated's `calculateNewStiffnessToMatchDuration` for a spring starting at rest. */
function stiffnessForDuration(
  x0: number,
  zeta: number,
  mass: number,
  duration: number,
  threshold: number,
): number {
  const settlingSeconds = (duration * 1.5) / 1000;
  const energyDiff = (stiffness: number) => {
    const omega0 = Math.sqrt(stiffness / mass) * zeta;
    const decay = Math.exp(-omega0 * settlingSeconds);
    const xtk = (x0 + x0 * omega0 * settlingSeconds) * decay;
    const vtk = (x0 + x0 * omega0 * settlingSeconds) * decay * -omega0 + x0 * omega0 * decay;
    return energy(xtk, vtk, stiffness, mass) / energy(x0, 0, stiffness, mass) - threshold;
  };
  return bisectRoot(Number.EPSILON, 8e3, energyDiff, threshold * 1e-3);
}

function springMotion(config: SpringConfig, x0: number): SpringMotion {
  const merged = { ...SPRING_DEFAULTS, ...config };
  const { mass, energyThreshold } = merged;
  if (config.duration !== undefined || config.dampingRatio !== undefined) {
    const zeta = merged.dampingRatio;
    const stiffness = stiffnessForDuration(x0, zeta, mass, merged.duration, energyThreshold);
    const omega0 = Math.sqrt(stiffness / mass);
    return {
      zeta,
      omega0,
      omega1: omega0 * Math.sqrt(1 - zeta ** 2),
      stiffness,
      mass,
      energyThreshold,
    };
  }
  const { damping, stiffness } = merged;
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const omega0 = Math.sqrt(stiffness / mass);
  return {
    zeta,
    omega0,
    omega1: omega0 * Math.sqrt(1 - zeta ** 2),
    stiffness,
    mass,
    energyThreshold,
  };
}

/** Displacement from the target and velocity `seconds` after release from rest at `x0`. */
function springState(motion: SpringMotion, x0: number, seconds: number) {
  const { zeta, omega0, omega1 } = motion;
  if (zeta < 1) {
    const envelope = Math.exp(-zeta * omega0 * seconds);
    const sin = Math.sin(omega1 * seconds);
    const cos = Math.cos(omega1 * seconds);
    const offset = envelope * (sin * ((zeta * omega0 * x0) / omega1) + x0 * cos);
    const velocity =
      -zeta * omega0 * offset + envelope * (cos * zeta * omega0 * x0 - omega1 * x0 * sin);
    return { offset, velocity };
  }
  const envelope = Math.exp(-omega0 * seconds);
  const offset = envelope * (x0 + omega0 * x0 * seconds);
  const velocity = envelope * -omega0 * (x0 + omega0 * x0 * seconds) + envelope * omega0 * x0;
  return { offset, velocity };
}

/**
 * `withSpring(toValue, config)` from rest. Reanimated snaps to the target once the spring's
 * energy falls to `energyThreshold` of its initial energy; energy only decreases, so that
 * moment is found by bisection.
 */
export function withSpring(toValue: number, config: SpringConfig = {}): Animation {
  const settled = new Map<number, { motion: SpringMotion; durationMs: number }>();
  const settle = (from: number) => {
    let entry = settled.get(from);
    if (!entry) {
      const x0 = from - toValue;
      const motion = springMotion(config, x0);
      const initial = energy(x0, 0, motion.stiffness, motion.mass);
      const isSettled = (ms: number) => {
        if (initial === 0) return true;
        const { offset, velocity } = springState(motion, x0, ms / 1000);
        return (
          energy(offset, velocity, motion.stiffness, motion.mass) / initial <=
          motion.energyThreshold
        );
      };
      let high = 1;
      while (!isSettled(high)) high *= 2;
      let low = 0;
      while (high - low > 0.5) {
        const middle = (low + high) / 2;
        if (isSettled(middle)) high = middle;
        else low = middle;
      }
      entry = { motion, durationMs: initial === 0 ? 0 : high };
      settled.set(from, entry);
    }
    return entry;
  };
  return {
    toValue,
    durationFrom: (from) => settle(from).durationMs,
    valueAt: (from, elapsedMs) => {
      const { motion, durationMs } = settle(from);
      if (elapsedMs >= durationMs) return toValue;
      return toValue + springState(motion, from - toValue, elapsedMs / 1000).offset;
    },
  };
}

/** `withDelay(delayMs, animation)`: holds the start value, then runs `animation`. */
export function withDelay(delayMs: number, animation: Animation): Animation {
  return {
    toValue: animation.toValue,
    durationFrom: (from) => delayMs + animation.durationFrom(from),
    valueAt: (from, elapsedMs) =>
      elapsedMs < delayMs ? from : animation.valueAt(from, elapsedMs - delayMs),
  };
}

/**
 * `withSequence(...animations)`, also used for an animation whose completion callback starts the
 * next one: each starts from the value the previous one finished on.
 */
export function withSequence(...animations: readonly Animation[]): Animation {
  const last = animations.at(-1);
  if (!last) {
    throw new Error('withSequence needs at least one animation');
  }
  return {
    toValue: last.toValue,
    durationFrom: (from) => {
      let total = 0;
      let start = from;
      for (const animation of animations) {
        total += animation.durationFrom(start);
        start = animation.toValue;
      }
      return total;
    },
    valueAt: (from, elapsedMs) => {
      let start = from;
      let remaining = elapsedMs;
      for (const animation of animations) {
        const duration = animation.durationFrom(start);
        if (remaining < duration) return animation.valueAt(start, remaining);
        remaining -= duration;
        start = animation.toValue;
      }
      return start;
    },
  };
}

/**
 * `withRepeat(animation, count, reverse)`; a negative count repeats forever. Without `reverse`
 * every iteration restarts from the start value; with it every other iteration runs the same
 * motion back to the start value, as Reanimated swaps the start and target.
 */
export function withRepeat(animation: Animation, count = -1, reverse = false): Animation {
  const legValue = (from: number, leg: number, elapsedMs: number): number => {
    const value = animation.valueAt(from, elapsedMs);
    if (!reverse || leg % 2 === 0) return value;
    const to = animation.toValue;
    if (to === from) return from;
    return to + (from - to) * ((value - from) / (to - from));
  };
  const endsAtStart = reverse && count >= 0 && count % 2 === 0;
  const finalValue = (from: number) => (endsAtStart ? from : animation.toValue);
  return {
    get toValue(): number {
      if (endsAtStart) {
        throw new Error('A reversed even repeat ends on its start value, which is not fixed');
      }
      return animation.toValue;
    },
    durationFrom: (from) => (count < 0 ? Infinity : count * animation.durationFrom(from)),
    valueAt: (from, elapsedMs) => {
      const legMs = animation.durationFrom(from);
      if (legMs <= 0) return finalValue(from);
      const leg = Math.floor(elapsedMs / legMs);
      if (count >= 0 && leg >= count) return finalValue(from);
      return legValue(from, leg, elapsedMs - leg * legMs);
    },
  };
}

/** A shared value: its initial value and the animation assigned to it when the effect starts. */
export interface Track {
  /** The value `elapsedMs` after the animation started. */
  at(elapsedMs: number): number;
  /** When the animation finishes; 0 for a value that never animates. */
  readonly endMs: number;
}

export function track(initial: number, animation?: Animation): Track {
  if (!animation) return { at: () => initial, endMs: 0 };
  return {
    at: (elapsedMs) => animation.valueAt(initial, Math.max(0, elapsedMs)),
    endMs: animation.durationFrom(initial),
  };
}

/** When every track has finished. */
export function settleMs(...tracks: readonly Track[]): number {
  return Math.max(0, ...tracks.map((entry) => entry.endMs));
}
