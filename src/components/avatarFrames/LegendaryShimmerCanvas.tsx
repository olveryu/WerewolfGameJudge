'use dom';

/**
 * LegendaryShimmerCanvas — 传说头像框专属动效层 (Canvas 2D)
 *
 * 三层动效叠加：
 * 1. 环绕光弧（orbiting arc）：金色光弧沿边框轨道匀速旋转（两对光点对向运动）
 * 2. 外围脉冲辉光（glow pulse）：金色发光呼吸（rect stroke opacity）
 * 3. 角落星尘（corner sparkles）：四角交替闪烁的光点
 *
 * 使用 Canvas 2D + rAF 驱动，不依赖 react-native-reanimated 或 react-native-svg。
 */
import { useEffect, useRef } from 'react';

/** 环绕光弧旋转周期（ms） */
const ORBIT_DURATION = 3000;
/** 辉光呼吸周期（ms） */
const GLOW_DURATION = 3200;
/** 星尘闪烁周期（ms） */
const SPARKLE_DURATION = 2400;

/** viewBox = -8 -8 116 116, so coordinate space is 116×116 */
const VB = 116;
const VB_OFFSET = 8; // -8 offset becomes +8 in canvas coords

/** Glow rect extends beyond border */
const GLOW_X = -3;
const GLOW_Y = -3;
const GLOW_W = 106;
const GLOW_H = 106;

/** Corner sparkle positions (viewBox coords) */
const SPARKLE_POSITIONS = [
  { x: 4, y: 4 },
  { x: 96, y: 4 },
  { x: 96, y: 96 },
  { x: 4, y: 96 },
] as const;

interface LegendaryShimmerCanvasProps {
  dom?: import('expo/dom').DOMProps;
  size: number;
  rx: number;
}

/**
 * Compute a point on the perimeter of a rectangle.
 * t ∈ [0,1) travels clockwise from top-left corner.
 */
function perimeterPoint(
  t: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const perimeter = 2 * (w + h);
  let d = (((t % 1) + 1) % 1) * perimeter;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d };
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h };
  d -= w;
  return { x: x0, y: y0 + h - d };
}

/**
 * Draw a rounded rect stroke onto the canvas context.
 */
function strokeRoundRect(
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
  ctx.stroke();
}

export default function LegendaryShimmerCanvas({ size, rx }: LegendaryShimmerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Scale factor: canvas CSS pixels per viewBox unit
    const scale = size / VB;

    let rafId = 0;
    let stopped = false;
    const startTime = performance.now();

    function draw() {
      if (stopped) return;
      const elapsed = performance.now() - startTime;

      // Progress values [0,1) — equivalent to Reanimated withRepeat(withTiming(1))
      const orbitT = (elapsed % ORBIT_DURATION) / ORBIT_DURATION;
      const glowT = (elapsed % GLOW_DURATION) / GLOW_DURATION;
      const sparkleT = (elapsed % SPARKLE_DURATION) / SPARKLE_DURATION;

      ctx!.clearRect(0, 0, size, size);
      ctx!.save();
      // Translate so viewBox (-8,-8) maps to (0,0)
      ctx!.scale(scale, scale);
      ctx!.translate(VB_OFFSET, VB_OFFSET);

      // ── Layer 1: Orbiting light arcs ───────────────────────────────────
      // orbit rect is at (-2,-2) width=104 height=104
      const orbitX = -2;
      const orbitY = -2;
      const orbitW = 104;
      const orbitH = 104;

      // Lead circle (bright warm white)
      const lead = perimeterPoint(orbitT, orbitX, orbitY, orbitW, orbitH);
      ctx!.globalAlpha = 0.7;
      ctx!.beginPath();
      ctx!.arc(lead.x, lead.y, 4, 0, Math.PI * 2);
      ctx!.fillStyle = '#FFFDE8';
      ctx!.fill();

      // Trail circle (dimmer gold, slightly behind)
      const trail = perimeterPoint(orbitT - 0.04, orbitX, orbitY, orbitW, orbitH);
      ctx!.globalAlpha = 0.35;
      ctx!.beginPath();
      ctx!.arc(trail.x, trail.y, 3, 0, Math.PI * 2);
      ctx!.fillStyle = '#FFD700';
      ctx!.fill();

      // Secondary lead (opposite side)
      const lead2 = perimeterPoint(orbitT + 0.5, orbitX, orbitY, orbitW, orbitH);
      ctx!.globalAlpha = 0.5;
      ctx!.beginPath();
      ctx!.arc(lead2.x, lead2.y, 3.5, 0, Math.PI * 2);
      ctx!.fillStyle = '#FFFDE8';
      ctx!.fill();

      // Secondary trail
      const trail2 = perimeterPoint(orbitT + 0.46, orbitX, orbitY, orbitW, orbitH);
      ctx!.globalAlpha = 0.25;
      ctx!.beginPath();
      ctx!.arc(trail2.x, trail2.y, 2.5, 0, Math.PI * 2);
      ctx!.fillStyle = '#FFD700';
      ctx!.fill();

      // ── Layer 2: Glow pulse (gold border breathing) ────────────────────
      const glowAlpha = 0.1 + Math.sin(glowT * Math.PI * 2) * 0.13;
      ctx!.globalAlpha = glowAlpha;
      ctx!.strokeStyle = '#F5A623';
      ctx!.lineWidth = 5;
      strokeRoundRect(ctx!, GLOW_X, GLOW_Y, GLOW_W, GLOW_H, rx + 2);

      // ── Layer 3: Corner sparkles (staggered phase) ─────────────────────
      for (let i = 0; i < 4; i++) {
        const t = (sparkleT + i * 0.25) % 1;
        const alpha = Math.max(0, Math.sin(t * Math.PI * 2)) * 0.75;
        const r = 1.2 + Math.sin(t * Math.PI * 2) * 1.0;
        if (alpha > 0.01) {
          ctx!.globalAlpha = alpha;
          ctx!.beginPath();
          ctx!.arc(SPARKLE_POSITIONS[i]!.x, SPARKLE_POSITIONS[i]!.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = '#FFD700';
          ctx!.fill();
        }
      }

      ctx!.restore();
      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [size, rx]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, pointerEvents: 'none' }} />;
}
