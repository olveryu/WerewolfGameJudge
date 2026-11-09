/**
 * Runtime the reveal effects animate on: the overlay's Pixi root, one clock driven by the stage
 * ticker, Reanimated-style shared values bound to that clock, and per-frame hooks that write
 * DOM styles. Every reveal frame reads the same ticker time, so DOM and canvas layers stay in
 * step and fake clocks drive captures deterministically. Pixi layer hooks live in `pixiLayer.ts`:
 * this module imports no PixiJS values, so the animator chunk that loads it never pulls PixiJS
 * in statically (which would merge PixiJS core into the scene-stage chunk).
 */
import type { Container } from 'pixi.js';
import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { Animation } from '@/scene/timeline';

import { CONFIG } from './config';

type FrameListener = (nowMs: number) => void;

/** The overlay's Pixi root and frame clock. */
export class RevealScene {
  private nowMs = performance.now();
  private readonly listeners = new Set<FrameListener>();

  /** `root` comes from the stage (`createOverlayRoot`), so this chunk loads no PixiJS itself. */
  constructor(readonly root: Container) {}

  /** The ticker time of the latest frame. */
  now(): number {
    return this.nowMs;
  }

  /** Advances the clock and runs every frame listener; the stage overlay calls it per frame. */
  frame(nowMs: number): void {
    this.nowMs = nowMs;
    for (const listener of [...this.listeners]) listener(nowMs);
  }

  subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const RevealSceneContext = createContext<RevealScene | null>(null);

export function useRevealScene(): RevealScene {
  const scene = useContext(RevealSceneContext);
  if (!scene) {
    throw new Error('Reveal effects render inside RevealSceneContext');
  }
  return scene;
}

/**
 * A Reanimated shared value on the reveal clock: `set` jumps, `animate` runs an animation from
 * the current value, and `get` reads the value at the current frame.
 */
export class SharedValue {
  private from: number;
  private animation: Animation | null = null;
  private startMs = 0;
  private stopWatching: (() => void) | null = null;

  constructor(
    private readonly scene: RevealScene,
    initial: number,
  ) {
    this.from = initial;
  }

  get(): number {
    if (!this.animation) return this.from;
    return this.animation.valueAt(this.from, Math.max(0, this.scene.now() - this.startMs));
  }

  set(value: number): void {
    this.cancel();
    this.from = value;
  }

  /** Starts `animation` from the current value; `onFinish` runs on the frame it finishes. */
  animate(animation: Animation, onFinish?: () => void): void {
    this.cancel();
    const startMs = this.scene.now();
    this.animation = animation;
    this.startMs = startMs;
    if (!onFinish) return;
    const durationMs = animation.durationFrom(this.from);
    this.stopWatching = this.scene.subscribe((nowMs) => {
      if (nowMs - startMs < durationMs) return;
      this.stopWatching?.();
      this.stopWatching = null;
      onFinish();
    });
  }

  /** Freezes the value where it is, like `cancelAnimation`. */
  cancel(): void {
    this.stopWatching?.();
    this.stopWatching = null;
    if (!this.animation) return;
    this.from = this.get();
    this.animation = null;
  }
}

/**
 * Reanimated's `interpolate`: maps `value` piecewise-linearly from `input` (ascending) to
 * `output`, extending the end segments past the range unless `clamp` is set.
 */
export function interpolate(
  value: number,
  input: readonly number[],
  output: readonly number[],
  clamp = false,
): number {
  if (input.length < 2 || input.length !== output.length) {
    throw new Error('interpolate needs matching input and output ranges of at least two points');
  }
  let segment = 0;
  while (segment < input.length - 2 && value > (input[segment + 1] ?? 0)) segment++;
  const inStart = input[segment] ?? 0;
  const inEnd = input[segment + 1] ?? 0;
  const outStart = output[segment] ?? 0;
  const outEnd = output[segment + 1] ?? 0;
  let progress = inEnd === inStart ? 0 : (value - inStart) / (inEnd - inStart);
  if (clamp) progress = Math.min(1, Math.max(0, progress));
  return outStart + (outEnd - outStart) * progress;
}

/** A shared value cancelled on unmount. */
export function useSharedValue(initial: number): SharedValue {
  const scene = useRevealScene();
  const [value] = useState(() => new SharedValue(scene, initial));
  useEffect(() => () => value.cancel(), [value]);
  return value;
}

/** Runs `onFrame` every frame while mounted with the frame's ticker time. */
export function useRevealFrame(onFrame: FrameListener): void {
  const scene = useRevealScene();
  const latest = useRef(onFrame);
  useEffect(() => {
    latest.current = onFrame;
  });
  useEffect(() => scene.subscribe((nowMs) => latest.current(nowMs)), [scene]);
}

/** The animated part of a DOM element's style, like a Reanimated `useAnimatedStyle` result. */
export interface FrameStyle {
  readonly opacity?: number;
  readonly transform?: string;
}

/** Writes `compute()` to the element behind `ref` every frame while it is mounted. */
export function useFrameStyle(
  ref: RefObject<HTMLElement | SVGElement | null>,
  compute: (nowMs: number) => FrameStyle,
): void {
  useRevealFrame((nowMs) => {
    const element = ref.current;
    if (!element) return;
    const style = compute(nowMs);
    if (style.opacity !== undefined) element.style.opacity = String(style.opacity);
    if (style.transform !== undefined) element.style.transform = style.transform;
  });
}

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

const getViewportWidth = () => window.innerWidth;
const getViewportHeight = () => window.innerHeight;

/** The window size, as `useWindowDimensions` gave the old effects. */
export function useViewportSize(): { readonly width: number; readonly height: number } {
  const width = useSyncExternalStore(subscribeViewport, getViewportWidth);
  const height = useSyncExternalStore(subscribeViewport, getViewportHeight);
  return { width, height };
}

/** The revealed card's size every effect shares: a share of the screen width, capped. */
export function useRevealCardSize(): { readonly width: number; readonly height: number } {
  const { width: screenWidth } = useViewportSize();
  const width = Math.min(screenWidth * CONFIG.common.cardWidthRatio, CONFIG.common.cardMaxWidth);
  return { width, height: width * CONFIG.common.cardAspectRatio };
}
