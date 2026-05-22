'use dom';

/**
 * FilmOverlayCanvas — Canvas 2D 胶片放映效果叠加层
 *
 * 渲染老式电影放映机视觉：暖色投影灯光 + 胶片边框齿孔 +
 * 胶片颗粒噪点 + 竖划痕 + 横划痕闪烁 + 暗角。
 * 齿孔自动滚动，噪点自动变化，不需要外部驱动。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const BORDER_W = 24;
const SPROCKET_SPACING = 40;
const SPROCKET_HOLE_W = 10;
const SPROCKET_HOLE_H = 14;
const SPROCKET_SCROLL_PERIOD = 600; // ms per sprocket spacing
const GRAIN_CYCLE_PERIOD = 500;
const SCRATCH_COUNT = 8;

const COLORS = {
  filmBorder: '#111111',
  sprocketOuter: '#1a1a1a',
  sprocketInner: '#080808',
  scratchLine: 'rgba(200, 180, 140, 0.04)',
  grainLight: 'rgba(255, 255, 255, 0.03)',
  grainDark: 'rgba(0, 0, 0, 0.03)',
  hScratchColor: 'rgba(200, 180, 140, 0.06)',
} as const;

interface FilmOverlayCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  animate: boolean;
}

export default function FilmOverlayCanvas({ width, height, animate }: FilmOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const sprocketCount = Math.ceil(height / SPROCKET_SPACING) + 2;

    // Pre-compute scratches
    const scratches = Array.from({ length: SCRATCH_COUNT }, (_, i) => ({
      x: width * (0.25 + ((i * 37 + 13) % 50) / 100),
      drift: (((i * 71 + 29) % 100) / 100) * 5,
    }));

    // Pre-compute grain
    const fieldW = width * 2;
    const fieldH = height * 2;
    const grainCount = 200;
    const grains = Array.from({ length: grainCount }, (_, i) => ({
      x: (((i * 73 + 17) % 2000) / 2000) * fieldW,
      y: (((i * 41 + 31) % 2000) / 2000) * fieldH,
      light: i % 2 === 0,
    }));

    // Pre-compute horizontal scratches
    const hScratches = Array.from({ length: 6 }, (_, i) => ({
      y: height * (0.1 + ((i * 43 + 7) % 90) / 100),
      phase: ((i * 67 + 13) % 100) / 100,
    }));

    const cleanup = createCanvasLoop({
      canvas,
      width,
      height,
      draw(ctx, elapsed) {
        // ── Warm projector glow ──
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          height * 0.7,
        );
        grad.addColorStop(0, 'rgba(60, 50, 30, 0.25)');
        grad.addColorStop(0.5, 'rgba(30, 25, 15, 0.10)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // ── Film borders ──
        ctx.fillStyle = COLORS.filmBorder;
        ctx.fillRect(0, 0, BORDER_W, height);
        ctx.fillRect(width - BORDER_W, 0, BORDER_W, height);

        // ── Sprocket holes (scrolling) ──
        const scrollOffset =
          ((elapsed % SPROCKET_SCROLL_PERIOD) / SPROCKET_SCROLL_PERIOD) * SPROCKET_SPACING;
        const leftCx = BORDER_W / 2;
        const rightCx = width - BORDER_W / 2;

        for (let i = 0; i < sprocketCount; i++) {
          const baseY = i * SPROCKET_SPACING;
          const y = (baseY + scrollOffset) % (sprocketCount * SPROCKET_SPACING);

          // Left outer
          roundRect(
            ctx,
            leftCx - SPROCKET_HOLE_W / 2,
            y - SPROCKET_HOLE_H / 2,
            SPROCKET_HOLE_W,
            SPROCKET_HOLE_H,
            2,
          );
          ctx.fillStyle = COLORS.sprocketOuter;
          ctx.fill();
          // Left inner
          roundRect(ctx, leftCx - 3, y - 5, 6, 10, 1);
          ctx.fillStyle = COLORS.sprocketInner;
          ctx.fill();
          // Right outer
          roundRect(
            ctx,
            rightCx - SPROCKET_HOLE_W / 2,
            y - SPROCKET_HOLE_H / 2,
            SPROCKET_HOLE_W,
            SPROCKET_HOLE_H,
            2,
          );
          ctx.fillStyle = COLORS.sprocketOuter;
          ctx.fill();
          // Right inner
          roundRect(ctx, rightCx - 3, y - 5, 6, 10, 1);
          ctx.fillStyle = COLORS.sprocketInner;
          ctx.fill();
        }

        // ── Vertical scratches ──
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLORS.scratchLine;
        for (const s of scratches) {
          ctx.beginPath();
          ctx.moveTo(s.x, 0);
          ctx.lineTo(s.x + s.drift, height);
          ctx.stroke();
        }

        // ── Film grain ──
        const grainT = (elapsed % GRAIN_CYCLE_PERIOD) / GRAIN_CYCLE_PERIOD;
        const shiftX = -grainT * width * 0.73;
        const shiftY = -grainT * height * 0.61;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        for (const g of grains) {
          const gx = g.x + shiftX;
          const gy = g.y + shiftY;
          // Wrap around
          const wx = ((gx % fieldW) + fieldW) % fieldW;
          const wy = ((gy % fieldH) + fieldH) % fieldH;
          if (wx < width && wy < height) {
            ctx.fillStyle = g.light ? COLORS.grainLight : COLORS.grainDark;
            ctx.fillRect(wx, wy, 1, 1);
          }
        }
        ctx.restore();

        // ── Horizontal scratches (flash) ──
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLORS.hScratchColor;
        for (const hs of hScratches) {
          const t = (grainT + hs.phase) % 1;
          if (t < 0.15) {
            ctx.globalAlpha = 0.08;
            ctx.beginPath();
            ctx.moveTo(0, hs.y);
            ctx.lineTo(width, hs.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        // ── Vignette ──
        const vGrad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          height * 0.7,
        );
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(0.7, 'rgba(0,0,0,0.3)');
        vGrad.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, width, height);
      },
    });

    return cleanup;
  }, [animate, width, height]);

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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
