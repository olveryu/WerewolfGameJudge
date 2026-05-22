'use dom';

/**
 * ScreenFlash — Canvas 2D 全屏闪光特效
 *
 * 翻牌揭示后从卡片中心迸裂：径向冲击波 + 迸射粒子。
 * 使用 HTML Canvas 2D + screen blend mode 实现。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';
import { easeOutQuad } from '../../canvas/easing';

// Pre-compute burst particle data (radial scatter)
const BURST_PARTICLE_COUNT = 20;
const BURST_PARTICLES = Array.from({ length: BURST_PARTICLE_COUNT }, (_, i) => {
  const angle = (i / BURST_PARTICLE_COUNT) * Math.PI * 2 + ((i * 7) % 10) * 0.06;
  const dist = 50 + ((i * 31) % 100) * 1.5;
  return { angle, dist, size: 1.5 + ((i * 13) % 20) / 10 };
});

const FLASH_BLUR = 30;
const PARTICLE_BLUR = 3;

interface ScreenFlashProps {
  dom?: import('expo/dom').DOMProps;
  /** Flash color (faction primary) */
  color: string;
  /** Peak opacity (per-alignment, from config) */
  peakOpacity: number;
  /** Flash duration (ms) */
  duration: number;
  /** Whether to animate */
  animate: boolean;
  /** Position: center X of the card in page coordinates */
  centerX: number;
  /** Position: center Y of the card in page coordinates */
  centerY: number;
  /** Logical width */
  width: number;
  /** Logical height */
  height: number;
  /** Delay before flash fires (ms) */
  delay?: number;
  /** Effect start delay from config (ms) */
  effectStartDelay?: number;
}

export default function ScreenFlash({
  color,
  peakOpacity,
  duration,
  animate,
  centerX,
  centerY,
  width,
  height,
  delay = 200,
  effectStartDelay = 100,
}: ScreenFlashProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const totalDelay = effectStartDelay + delay;
    const startTime = performance.now() + totalDelay;

    const cleanup = createCanvasLoop({
      canvas,
      width,
      height,
      draw(ctx, _elapsed) {
        const now = performance.now();
        if (now < startTime) return;

        const elapsed = now - startTime;

        // Two-phase progress: fast initial burst (15%) + gradual fade (85%)
        let progress: number;
        if (elapsed < duration * 0.15) {
          progress = easeOutQuad(elapsed / (duration * 0.15)) * 0.15;
        } else if (elapsed < duration) {
          const p2 = (elapsed - duration * 0.15) / (duration * 0.85);
          progress = 0.15 + easeOutQuad(p2) * 0.85;
        } else {
          progress = 1;
        }

        if (progress >= 1) return;

        // ── Radial shockwave ──
        const waveR = progress * width;
        let waveOpacity: number;
        if (progress < 0.15) {
          waveOpacity = (progress / 0.15) * peakOpacity;
        } else {
          waveOpacity = Math.max(0, peakOpacity * (1 - (progress - 0.15) / 0.85));
        }

        if (waveOpacity > 0.01) {
          ctx.save();
          ctx.filter = `blur(${FLASH_BLUR}px)`;
          ctx.globalAlpha = waveOpacity;
          const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, waveR);
          grad.addColorStop(0, color);
          grad.addColorStop(0.5, color + '80');
          grad.addColorStop(1, color + '00');
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }

        // ── Burst particles with screen blend mode ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = `blur(${PARTICLE_BLUR}px)`;
        for (const bp of BURST_PARTICLES) {
          const px = centerX + Math.cos(bp.angle) * bp.dist * progress;
          const py = centerY + Math.sin(bp.angle) * bp.dist * progress;
          const pOpacity =
            progress < 0.05 ? progress / 0.05 : Math.max(0, 1 - (progress - 0.05) / 0.6);
          const r = bp.size * Math.max(0.3, 1 - progress * 0.7);
          if (pOpacity > 0.01) {
            ctx.globalAlpha = pOpacity;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }
        }
        ctx.restore();
      },
    });

    cleanupRef.current = cleanup;
    return cleanup;
  }, [animate, color, peakOpacity, duration, centerX, centerY, width, height, delay, effectStartDelay]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
