'use dom';

/**
 * FlairCanvas — shared 'use dom' Canvas component for all seat flair animations.
 *
 * Renders any flair given its flairId. Uses rAF loop + Canvas 2D.
 * All draw functions are bundled here — replaces react-native-svg + Reanimated.
 */
import { useEffect, useRef } from 'react';

import { FLAIR_DRAW_MAP } from './draw';
import type { FlairColors } from './draw/types';

interface FlairCanvasProps {
  dom?: import('expo/dom').DOMProps;
  size: number;
  flairId: string;
  colors?: FlairColors;
}

export default function FlairCanvas({ size, flairId, colors }: FlairCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = FLAIR_DRAW_MAP[flairId];
    if (!config) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const { durations, draw } = config;
    const startTime = performance.now();
    let rafId = 0;
    let stopped = false;

    function frame() {
      if (stopped) return;
      const elapsed = performance.now() - startTime;

      // Compute progress for each timer (length always === durations.length ≥ 1)
      const progress = durations.map((d) => (elapsed % d) / d) as [number, ...number[]];

      ctx!.clearRect(0, 0, size, size);
      draw(ctx!, size, progress, colors);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [size, flairId, colors]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, pointerEvents: 'none' }} />;
}
