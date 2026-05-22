'use dom';

/**
 * WolfCrackBackground — Canvas 2D 裂痕背景层
 *
 * 渲染在角色图片之后（z-order 更低），模拟卡片从内部裂开、
 * 裂缝中透出暗红能量光的效果。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const EFFECT_START_DELAY = 100;

// Main cracks: polylines from center (ratio coordinates 0–1)
const CRACK_MAIN = [
  [[0.5, 0.42], [0.47, 0.36], [0.44, 0.32], [0.40, 0.28], [0.38, 0.22], [0.35, 0.15], [0.33, 0.08]],
  [[0.5, 0.42], [0.53, 0.37], [0.57, 0.33], [0.60, 0.27], [0.63, 0.20], [0.66, 0.12]],
  [[0.5, 0.42], [0.45, 0.40], [0.40, 0.38], [0.34, 0.36], [0.28, 0.34], [0.22, 0.33]],
  [[0.5, 0.42], [0.55, 0.41], [0.60, 0.39], [0.66, 0.40], [0.72, 0.38], [0.78, 0.37]],
  [[0.5, 0.42], [0.47, 0.48], [0.43, 0.54], [0.39, 0.60], [0.35, 0.68], [0.30, 0.76]],
  [[0.5, 0.42], [0.54, 0.47], [0.58, 0.53], [0.62, 0.60], [0.67, 0.68], [0.72, 0.78]],
] as const;

const CRACK_BRANCHES = [
  [[0.44, 0.32], [0.41, 0.30], [0.37, 0.29]],
  [[0.40, 0.28], [0.43, 0.24], [0.44, 0.19]],
  [[0.57, 0.33], [0.60, 0.31], [0.64, 0.30]],
  [[0.60, 0.27], [0.57, 0.23], [0.56, 0.18]],
  [[0.40, 0.38], [0.38, 0.42], [0.34, 0.44]],
  [[0.34, 0.36], [0.31, 0.32], [0.27, 0.30]],
  [[0.60, 0.39], [0.62, 0.43], [0.66, 0.45]],
  [[0.66, 0.40], [0.69, 0.36], [0.73, 0.34]],
  [[0.43, 0.54], [0.40, 0.56], [0.36, 0.55]],
  [[0.39, 0.60], [0.42, 0.64], [0.43, 0.70]],
  [[0.58, 0.53], [0.61, 0.55], [0.65, 0.54]],
  [[0.62, 0.60], [0.59, 0.64], [0.58, 0.70]],
] as const;

// Debris chips — triangular fragments
const DEBRIS_CHIPS = [
  [[0.42, 0.29], [0.46, 0.26], [0.41, 0.26]],
  [[0.38, 0.23], [0.42, 0.20], [0.36, 0.21]],
  [[0.57, 0.30], [0.61, 0.27], [0.56, 0.28]],
  [[0.61, 0.23], [0.65, 0.20], [0.60, 0.21]],
  [[0.37, 0.36], [0.41, 0.33], [0.36, 0.34]],
  [[0.62, 0.37], [0.66, 0.34], [0.61, 0.35]],
  [[0.41, 0.54], [0.45, 0.51], [0.40, 0.52]],
  [[0.58, 0.54], [0.62, 0.51], [0.57, 0.52]],
] as const;

// ─── Easing ───────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ─── Component ────────────────────────────────────────────────────────

interface WolfCrackBackgroundCanvasProps {
  dom?: import('expo/dom').DOMProps;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
}

export default function WolfCrackBackgroundCanvas({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
}: WolfCrackBackgroundCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const cleanup = createCanvasLoop({
      canvas,
      width: cardWidth,
      height: cardHeight,
      draw(ctx, elapsed) {
        const t = elapsed - EFFECT_START_DELAY;
        if (t < 0) return;

        // crackSpread: 0→1 over 1800ms (starts at +100ms from effectStartDelay)
        const spreadT = Math.max(0, t - 100);
        const crackSpread = Math.min(1, easeOutCubic(Math.min(spreadT / 1800, 1)));
        // crackOpacity: 0→0.85 over 1200ms
        const crackOpacity = Math.min(0.85, easeOutQuad(Math.min(t / 1200, 1)) * 0.85);

        const mainEnd = Math.min(1, crackSpread * 1.2);
        const branchEnd = Math.max(0, Math.min(1, (crackSpread - 0.3) * 1.8));
        const debrisOp = Math.max(0, Math.min(0.7, (crackSpread - 0.4) * 2));

        if (crackOpacity <= 0) return;
        ctx.globalAlpha = crackOpacity;

        // ── Layer 1: Shadow/damage halo (wide, dark, blurry) ──
        if (mainEnd > 0) {
          ctx.save();
          ctx.globalAlpha = crackOpacity * 0.6;
          ctx.filter = 'blur(5px)';
          ctx.strokeStyle = '#1a0000';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const crack of CRACK_MAIN) {
            drawPartialPath(ctx, crack, mainEnd, cardWidth, cardHeight);
          }
          ctx.restore();
        }

        // ── Layer 2: Crack edge (medium, primary color) ──
        if (mainEnd > 0) {
          ctx.save();
          ctx.globalAlpha = crackOpacity;
          ctx.filter = 'blur(0.3px)';
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const crack of CRACK_MAIN) {
            drawPartialPath(ctx, crack, mainEnd, cardWidth, cardHeight);
          }
          ctx.restore();
        }

        // ── Layer 3: Glow core (muted dark red) ──
        if (mainEnd > 0) {
          ctx.save();
          ctx.globalAlpha = crackOpacity * 0.7;
          ctx.filter = 'blur(0.6px)';
          ctx.strokeStyle = '#661100';
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const crack of CRACK_MAIN) {
            drawPartialPath(ctx, crack, mainEnd, cardWidth, cardHeight);
          }
          ctx.restore();
        }

        // ── Branch cracks ──
        if (branchEnd > 0) {
          // Edge
          ctx.save();
          ctx.globalAlpha = crackOpacity * 0.6;
          ctx.filter = 'blur(0.3px)';
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1.0;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const branch of CRACK_BRANCHES) {
            drawPartialPath(ctx, branch, branchEnd, cardWidth, cardHeight);
          }
          ctx.restore();
          // Glow
          ctx.save();
          ctx.globalAlpha = crackOpacity * 0.4;
          ctx.filter = 'blur(0.4px)';
          ctx.strokeStyle = '#661100';
          ctx.lineWidth = 0.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const branch of CRACK_BRANCHES) {
            drawPartialPath(ctx, branch, branchEnd, cardWidth, cardHeight);
          }
          ctx.restore();
        }

        // ── Debris chips ──
        if (debrisOp > 0) {
          ctx.save();
          ctx.globalAlpha = crackOpacity * debrisOp * 0.9;
          ctx.filter = 'blur(0.3px)';
          ctx.fillStyle = primaryColor;
          for (const chip of DEBRIS_CHIPS) {
            ctx.beginPath();
            ctx.moveTo(chip[0][0] * cardWidth, chip[0][1] * cardHeight);
            ctx.lineTo(chip[1][0] * cardWidth, chip[1][1] * cardHeight);
            ctx.lineTo(chip[2][0] * cardWidth, chip[2][1] * cardHeight);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      },
    });

    return cleanup;
  }, [animate, cardWidth, cardHeight, primaryColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: cardWidth,
        height: cardHeight,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Utilities ────────────────────────────────────────────────────────

/** Draw a partial polyline (0→end fraction of segments) */
function drawPartialPath(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  end: number,
  w: number,
  h: number,
): void {
  if (points.length < 2) return;
  const totalSegments = points.length - 1;
  const segmentsToShow = end * totalSegments;
  const fullSegments = Math.floor(segmentsToShow);
  const partialFraction = segmentsToShow - fullSegments;

  ctx.beginPath();
  ctx.moveTo(points[0][0] * w, points[0][1] * h);

  for (let i = 0; i < fullSegments && i < totalSegments; i++) {
    ctx.lineTo(points[i + 1][0] * w, points[i + 1][1] * h);
  }

  // Partial last segment
  if (fullSegments < totalSegments && partialFraction > 0) {
    const from = points[fullSegments]!;
    const to = points[fullSegments + 1]!;
    const x = from[0] + (to[0] - from[0]) * partialFraction;
    const y = from[1] + (to[1] - from[1]) * partialFraction;
    ctx.lineTo(x * w, y * h);
  }

  ctx.stroke();
}
