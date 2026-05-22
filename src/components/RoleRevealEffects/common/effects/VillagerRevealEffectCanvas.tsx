'use dom';

/**
 * VillagerRevealEffect — Canvas 2D 村民阵营揭示特效
 *
 * 翻牌后在卡片区域渲染宁静夜空系列动画：
 * 1. 卡片光晕 — RadialGradient + blur，柔和爆发→持续微弱暖色发光
 * 2. 护盾涟漪（2 层）— Circle stroke + blur，从中心柔和扩散后淡出
 * 3. 萤火虫粒子（16 颗）— Circle + blur + screen，缓慢漂浮上升
 * 4. 闪烁星点（10 颗）— 十字 sparkle + blur，固定位置交替闪烁
 *
 * 萤火虫和星光持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const EFFECT_START_DELAY = 100;
const MAIN_DURATION = 2500;
const GLOW_BLUR = 12;
const PARTICLE_BLUR = 4; // SK.particleBlur + 1
const FIREFLY_COUNT = 16;
const STAR_COUNT = 10;
const FIREFLY_CYCLE_MS = 5000;
const TWINKLE_CYCLE_MS = 3000;

const RIPPLE_CONFIGS = [
  { startP: 0.05, durationP: 0.45, maxScale: 2.5, peakOpacity: 0.25 },
  { startP: 0.18, durationP: 0.47, maxScale: 3, peakOpacity: 0.15 },
] as const;

const FIREFLIES = Array.from({ length: FIREFLY_COUNT }, (_, i) => {
  const phase = (i / FIREFLY_COUNT) * 360;
  const xRatio = 0.08 + ((i * 61 + 17) % 84) / 100;
  const startYRatio = 0.55 + ((i * 37 + 11) % 40) / 100;
  const driftRatio = 0.35 + ((i * 23 + 7) % 30) / 100;
  const wobbleRatio = 0.03 + ((i * 13 + 3) % 40) / 1000;
  const sizeRatio = (2 + (i % 3)) / 320;
  return { phase, xRatio, startYRatio, driftRatio, wobbleRatio, sizeRatio };
});

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => {
  const angle = (i / STAR_COUNT) * Math.PI * 2 + ((i * 0.3) % 0.6);
  const rRatio = 0.32 + ((i * 17 + 5) % 18) / 100;
  const xRatio = 0.5 + Math.cos(angle) * rRatio;
  const yRatio = 0.42 + Math.sin(angle) * rRatio * 0.75;
  const sizeRatio = (1.5 + (i % 3)) / 320;
  const twinklePhase = ((i * 83 + 11) % 628) / 100;
  return { xRatio, yRatio, sizeRatio, twinklePhase };
});

// ─── Easing helpers ───────────────────────────────────────────────────

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Glow intensity: burst 0→1 (400ms) → 1→0.5 (600ms) → 0.5→0.25 (1500ms)
function computeGlowIntensity(t: number): number {
  if (t < 400) return easeOutCubic(t / 400);
  if (t < 1000) return 1 - 0.5 * easeOutQuad((t - 400) / 600);
  if (t < 2500) return 0.5 - 0.25 * easeOutQuad((t - 1000) / 1500);
  return 0.25;
}

// Appear: starts at +300ms, 0→1 over 500ms
function computeAppear(t: number): number {
  const at = t - 300;
  if (at <= 0) return 0;
  return Math.min(1, easeOutQuad(at / 500));
}

// ─── Component ────────────────────────────────────────────────────────

interface VillagerRevealEffectCanvasProps {
  dom?: import('expo/dom').DOMProps;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export default function VillagerRevealEffectCanvas({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}: VillagerRevealEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const centerX = cardWidth / 2;
    const centerY = cardHeight * 0.42;

    const cleanup = createCanvasLoop({
      canvas,
      width: cardWidth,
      height: cardHeight,
      draw(ctx, elapsed) {
        const t = elapsed - EFFECT_START_DELAY;
        if (t < 0) return;

        const progress = Math.min(1, easeOutQuad(Math.min(t / MAIN_DURATION, 1)));
        const appear = computeAppear(t);
        const glowI = computeGlowIntensity(t);

        // ── 1. Persistent card glow ──
        const glowR = cardWidth * 0.45 * (0.5 + glowI * 0.5);
        const glowOpacity = glowI * 0.55;

        ctx.save();
        ctx.globalAlpha = glowOpacity;
        ctx.filter = `blur(${GLOW_BLUR}px)`;
        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowR);
        grad.addColorStop(0, glowColor);
        grad.addColorStop(0.5, hexWithAlpha(primaryColor, 0.31));
        grad.addColorStop(1, hexWithAlpha(primaryColor, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ── 2. Soft flash overlay ──
        const rawP = Math.min(t / MAIN_DURATION, 1);
        let flashOpacity: number;
        if (rawP < 0.06) flashOpacity = (rawP / 0.06) * 0.4;
        else if (rawP < 0.15) flashOpacity = 0.4 * (1 - ((rawP - 0.06) / 0.09) * 0.6);
        else if (rawP < 0.35) flashOpacity = 0.16 * (1 - (rawP - 0.15) / 0.2);
        else flashOpacity = 0;

        if (flashOpacity > 0.01) {
          ctx.save();
          ctx.globalAlpha = flashOpacity;
          ctx.filter = 'blur(20px)';
          const fGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            cardWidth * 0.6,
          );
          fGrad.addColorStop(0, hexWithAlpha(primaryColor, 0.5));
          fGrad.addColorStop(1, hexWithAlpha(primaryColor, 0));
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, cardWidth * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── 3. Shield ripples ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(4px)';
        for (const cfg of RIPPLE_CONFIGS) {
          const endP = cfg.startP + cfg.durationP;
          const lp = Math.min(1, Math.max(0, (progress - cfg.startP) / (endP - cfg.startP)));
          if (lp <= 0) continue;
          const baseR = cardWidth * 0.12;
          const r = baseR * (1 + lp * (cfg.maxScale - 1));
          let opacity: number;
          if (lp < 0.1) opacity = cfg.peakOpacity;
          else if (lp < 0.4) opacity = cfg.peakOpacity * 0.8;
          else opacity = Math.max(0, cfg.peakOpacity * (1 - (lp - 0.4) / 0.6));
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // ── 4. Twinkling stars (sparkle cross ✦) ──
        if (appear > 0) {
          const twinkleVal = ((t % TWINKLE_CYCLE_MS) / TWINKLE_CYCLE_MS) * Math.PI * 2;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (const star of STARS) {
            const x = star.xRatio * cardWidth;
            const y = star.yRatio * cardHeight;
            const size = Math.max(1.5, star.sizeRatio * cardWidth);
            const sinVal = Math.sin(twinkleVal + star.twinklePhase);
            let alpha: number;
            if (sinVal < -0.2) alpha = 0.05 + ((sinVal + 1) / 0.8) * 0.1;
            else if (sinVal < 0.2) alpha = 0.15 + ((sinVal + 0.2) / 0.4) * 0.35;
            else alpha = 0.5 + ((sinVal - 0.2) / 0.8) * 0.35;
            const opacity = appear * alpha;
            ctx.globalAlpha = opacity;
            drawSparkle(ctx, x, y, size, particleColor, size > 2.5);
          }
          ctx.restore();
        }

        // ── 5. Floating fireflies ──
        if (appear > 0) {
          const cycleVal = ((t % FIREFLY_CYCLE_MS) / FIREFLY_CYCLE_MS) * 360;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.filter = `blur(${PARTICLE_BLUR}px)`;
          for (const ff of FIREFLIES) {
            const baseX = ff.xRatio * cardWidth;
            const startY = ff.startYRatio * cardHeight;
            const driftHeight = ff.driftRatio * cardHeight;
            const wobbleAmp = ff.wobbleRatio * cardWidth;
            const size = Math.max(1.5, ff.sizeRatio * cardWidth);
            const currentPhase = (cycleVal + ff.phase) % 360;
            const ft = currentPhase / 360;
            const cx = baseX + Math.sin(((currentPhase * Math.PI) / 180) * 3) * wobbleAmp;
            const cy = startY - ft * driftHeight;
            let alpha: number;
            if (ft < 0.12) alpha = (ft / 0.12) * 0.85;
            else if (ft < 0.65) alpha = 0.85;
            else alpha = 0.85 * (1 - (ft - 0.65) / 0.35);
            const opacity = appear * Math.max(0, alpha);
            ctx.globalAlpha = opacity;
            ctx.fillStyle = particleColor;
            ctx.beginPath();
            ctx.arc(cx, cy, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      },
    });

    return cleanup;
  }, [animate, cardWidth, cardHeight, primaryColor, glowColor, particleColor]);

  const canvasStyle = {
    width: cardWidth,
    height: cardHeight,
    display: 'block' as const,
    pointerEvents: 'none' as const,
  };
  return <canvas ref={canvasRef} style={canvasStyle} />;
}

// ─── Utilities ────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.slice(0, 7) + a;
}

/** Draw a 4-pointed sparkle (cross shape) */
function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  bright: boolean,
): void {
  const armLength = r * (bright ? 2.5 : 2);
  const coreR = r * 0.3;
  const blur = bright ? 5 : 3;

  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = color;
  // Core circle
  ctx.beginPath();
  ctx.arc(x, y, coreR, 0, Math.PI * 2);
  ctx.fill();
  // Vertical arm
  ctx.beginPath();
  ctx.moveTo(x, y - armLength);
  ctx.lineTo(x + coreR * 0.4, y);
  ctx.lineTo(x, y + armLength);
  ctx.lineTo(x - coreR * 0.4, y);
  ctx.closePath();
  ctx.fill();
  // Horizontal arm
  ctx.beginPath();
  ctx.moveTo(x - armLength, y);
  ctx.lineTo(x, y - coreR * 0.4);
  ctx.lineTo(x + armLength, y);
  ctx.lineTo(x, y + coreR * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
