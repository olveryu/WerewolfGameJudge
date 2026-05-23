'use dom';
/**
 * AnimationOverlay — 'use dom' Canvas component for seat animation overlays.
 *
 * Renders the burst/particle/glow effects that accompany entrance animations.
 * Runs its own rAF loop for the specified duration, then stops.
 * Position: absolute fill, pointer-events none.
 */
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { OVERLAY_DRAW_MAP } from './draw';
import { easeOutCubic } from './draw/helpers';

const CANVAS_BASE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
};

interface AnimationOverlayProps {
  dom?: DOMProps;
  /** Canvas size (px) */
  size: number;
  /** Total animation duration (ms) */
  duration: number;
  /** Draw function ID from OVERLAY_DRAW_MAP */
  effectId: string;
  /** Primary color (rgb string) */
  color: string;
  /** Secondary/accent color (rgb string, defaults to color) */
  accentColor?: string;
  /** JSON-serialized extra params for the draw function */
  params?: string;
  /** Easing mode: 'easeOutCubic' (default) or 'linear' */
  easing?: 'easeOutCubic' | 'linear';
}

export default function AnimationOverlay({
  size,
  duration,
  effectId,
  color,
  accentColor,
  params,
  easing = 'easeOutCubic',
}: AnimationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFn = OVERLAY_DRAW_MAP[effectId];
    if (!drawFn) return;

    const parsedParams: Record<string, unknown> = params
      ? (JSON.parse(params) as Record<string, unknown>)
      : {};
    const accent = accentColor || color;
    const easeFn = easing === 'linear' ? (t: number) => t : easeOutCubic;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = easeFn(rawProgress);

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      drawFn(ctx, progress, size, color, accent, parsedParams);
      ctx.restore();

      if (rawProgress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [size, duration, effectId, color, accentColor, params, easing]);

  return <canvas ref={canvasRef} style={{ ...CANVAS_BASE_STYLE, width: size, height: size }} />;
}
