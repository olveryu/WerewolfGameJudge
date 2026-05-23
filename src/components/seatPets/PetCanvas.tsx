'use dom';

/**
 * PetCanvas — shared 'use dom' Canvas component for all seat pet animations.
 *
 * Renders any pet given its petId. Uses rAF loop + Canvas 2D.
 * Float bob (translateY oscillation) is built-in per pet config.
 */
import { useEffect, useRef } from 'react';

import { PET_DRAW_MAP } from './draw';

interface PetCanvasProps {
  dom?: import('expo/dom').DOMProps;
  size: number;
  petId: string;
}

export default function PetCanvas({ size, petId }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = PET_DRAW_MAP[petId];
    if (!config) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const { floatDuration, durations, draw } = config;
    const startTime = performance.now();
    let rafId = 0;
    let stopped = false;

    function frame() {
      if (stopped) return;
      const elapsed = performance.now() - startTime;

      // Float bob: sinusoidal translateY (±4px equivalent at viewBox 72)
      const floatT = (elapsed % floatDuration) / floatDuration;
      const floatY = Math.sin(floatT * Math.PI * 2) * -4 * (size / 72);

      // Pet-specific timer progress
      const progress = durations.map((d) => (elapsed % d) / d) as [number, ...number[]];

      ctx!.clearRect(0, 0, size, size);
      ctx!.save();
      ctx!.translate(0, floatY);
      draw(ctx!, size / 72, progress);
      ctx!.restore();

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [size, petId]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, pointerEvents: 'none' }} />;
}
