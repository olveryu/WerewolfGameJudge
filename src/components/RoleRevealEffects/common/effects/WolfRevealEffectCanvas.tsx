'use dom';

/**
 * WolfRevealEffect — Canvas 2D 狼人阵营揭示特效
 *
 * 翻牌后在卡片区域渲染暗红恐怖系列动画：
 * 1. 卡片辉光 — RadialGradient + blur，从极亮爆发→持续微弱暗红发光
 * 2. 暗红雾气 — 多层 Circle + blur 模拟干冰烟雾弥漫
 * 3. 血滴粒子 — 5 颗水滴形液滴从卡片顶部加速滴落（带拖尾辉光）
 * 4. 狼瞳脉冲 — 两只暗红光点在暗处脉动
 * 5. 暗色冲击波 — 2 层从中心扩散的波纹
 * 6. 火花碎片 — 24 颗从中心射出的粒子
 *
 * 情绪签名：slow burn（缓慢升温的不安）。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const EFFECT_START_DELAY = 100;
const MAIN_DURATION = 2500;
const GLOW_BLUR = 12;
const PARTICLE_BLUR = 3;
const SPARK_COUNT = 24;
const FOG_DRIFT_DURATION = 6000;
const EYE_PULSE_DURATION = 2400; // 1200 up + 1200 down
const BLOOD_CYCLE_DURATION = 1000;

const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 3) * 0.15;
  const distRatio = 0.28 + ((i * 37) % 100) / 140;
  const hue = (i * 17) % 40;
  const lightness = 50 + ((i * 13) % 30);
  return {
    targetXRatio: Math.cos(angle) * distRatio,
    targetYRatio: Math.sin(angle) * distRatio,
    sizeRatio: (1.5 + ((i * 13) % 30) / 10) / 140,
    delay: 0.06 + (i / SPARK_COUNT) * 0.12,
    color: `hsl(${hue}, 100%, ${lightness}%)`,
  };
});

const BLOOD_DROPS = [
  { xRatio: 0.12, size: 5.5, speed: 2800, delay: 0 },
  { xRatio: 0.88, size: 5, speed: 3200, delay: 400 },
  { xRatio: 0.28, size: 5, speed: 3600, delay: 800 },
  { xRatio: 0.72, size: 6, speed: 2600, delay: 1200 },
  { xRatio: 0.5, size: 5, speed: 3400, delay: 600 },
];

const FOG_CLOUDS = [
  { xRatio: 0.25, yRatio: 0.7, rRatio: 0.45, driftX: 8, driftYAmp: 6, alphaRatio: 0.5 },
  { xRatio: 0.75, yRatio: 0.65, rRatio: 0.4, driftX: -10, driftYAmp: 5, alphaRatio: 0.45 },
  { xRatio: 0.5, yRatio: 0.8, rRatio: 0.5, driftX: 6, driftYAmp: 8, alphaRatio: 0.55 },
  { xRatio: 0.35, yRatio: 0.75, rRatio: 0.3, driftX: -12, driftYAmp: 4, alphaRatio: 0.6 },
  { xRatio: 0.65, yRatio: 0.85, rRatio: 0.35, driftX: 10, driftYAmp: 7, alphaRatio: 0.5 },
  { xRatio: 0.15, yRatio: 0.9, rRatio: 0.2, driftX: 15, driftYAmp: 10, alphaRatio: 0.7 },
  { xRatio: 0.85, yRatio: 0.78, rRatio: 0.22, driftX: -14, driftYAmp: 9, alphaRatio: 0.65 },
  { xRatio: 0.5, yRatio: 0.95, rRatio: 0.38, driftX: -5, driftYAmp: 6, alphaRatio: 0.4 },
];

// ─── Easing helpers ───────────────────────────────────────────────────

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSin(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Glow: burst 0→1 (300ms) → 1→0.6 (575ms) → 0.6→0.35 (1625ms)
function computeGlowIntensity(t: number): number {
  if (t < 300) return easeOutCubic(t / 300);
  if (t < 875) return 1 - 0.4 * easeOutQuad((t - 300) / 575);
  if (t < 2500) return 0.6 - 0.25 * easeOutQuad((t - 875) / 1625);
  return 0.35;
}

// Eye pulse: starts at 500ms, sin wave 0→1→0 over 2400ms
function computeEyePulse(t: number): number {
  const et = t - 500;
  if (et <= 0) return 0;
  const phase = (et % EYE_PULSE_DURATION) / EYE_PULSE_DURATION;
  return phase < 0.5 ? easeInOutSin(phase * 2) : easeInOutSin((1 - phase) * 2);
}

// ─── Component ────────────────────────────────────────────────────────

interface WolfRevealEffectCanvasProps {
  dom?: import('expo/dom').DOMProps;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export default function WolfRevealEffectCanvas({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
}: WolfRevealEffectCanvasProps) {
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
      duration: EFFECT_START_DELAY + MAIN_DURATION + 500,
      draw(ctx, elapsed) {
        const t = elapsed - EFFECT_START_DELAY;
        if (t < 0) return;

        const progress = Math.min(1, easeOutQuad(Math.min(t / MAIN_DURATION, 1)));
        const glowI = computeGlowIntensity(t);
        const eyePulse = computeEyePulse(t);

        // ── 1. Card glow ──
        const glowR = cardWidth * 0.6 * (0.5 + glowI * 0.5);
        const glowOpacity = glowI * 0.6;

        ctx.save();
        ctx.globalAlpha = glowOpacity;
        ctx.filter = `blur(${GLOW_BLUR}px)`;
        const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowR);
        grad.addColorStop(0, glowColor);
        grad.addColorStop(0.5, hexWithAlpha(primaryColor, 0.38));
        grad.addColorStop(1, hexWithAlpha(primaryColor, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ── 2. Fog clouds ──
        const fogDrift = (t % FOG_DRIFT_DURATION) / FOG_DRIFT_DURATION;
        ctx.save();
        ctx.filter = 'blur(25px)';
        for (let i = 0; i < FOG_CLOUDS.length; i++) {
          const fog = FOG_CLOUDS[i]!;
          const r = fog.rRatio * cardWidth;
          const cx = fog.xRatio * cardWidth + Math.sin(fogDrift * Math.PI * 2 + i) * fog.driftX;
          const cy =
            fog.yRatio * cardHeight +
            Math.cos(fogDrift * Math.PI * 2 * 0.7 + i * 1.3) * fog.driftYAmp;
          const opacity =
            fog.alphaRatio * (0.8 + 0.2 * Math.sin(fogDrift * Math.PI * 2 * 0.5 + i * 2));
          const fGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          fGrad.addColorStop(0, hexWithAlpha(primaryColor, 0.56));
          fGrad.addColorStop(0.5, hexWithAlpha(primaryColor, 0.25));
          fGrad.addColorStop(1, hexWithAlpha(primaryColor, 0));
          ctx.globalAlpha = opacity;
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // ── 3. Blood drops ──
        const bloodTimeMs = t % BLOOD_CYCLE_DURATION;
        ctx.save();
        for (const drop of BLOOD_DROPS) {
          const dropElapsed = Math.max(0, bloodTimeMs - drop.delay);
          const _p = (dropElapsed % drop.speed) / drop.speed;
          // Real-time: p based on actual elapsed time in continuous cycle
          const actualP = ((t - drop.delay) % drop.speed) / drop.speed;
          const cx = drop.xRatio * cardWidth;
          const cy = Math.max(0, actualP) * cardHeight * 0.95;
          const streakW = drop.size * 0.6;

          // Streak
          const streakH = Math.max(0, cy - drop.size * 2);
          let streakOp: number;
          if (actualP < 0.08) streakOp = 0;
          else if (actualP > 0.85) streakOp = Math.max(0, (1 - actualP) / 0.15) * 0.2;
          else streakOp = Math.min(0.2, (actualP - 0.08) * 0.8);

          if (streakH > 0 && streakOp > 0) {
            ctx.globalAlpha = streakOp;
            ctx.fillStyle = '#cc1111';
            ctx.fillRect(cx - streakW / 2, 0, streakW, streakH);
          }

          // Teardrop body
          let dropOp: number;
          if (actualP < 0.05) dropOp = actualP / 0.05;
          else if (actualP > 0.85) dropOp = Math.max(0, (1 - actualP) / 0.15);
          else dropOp = 0.9;

          if (dropOp > 0 && actualP > 0) {
            ctx.globalAlpha = dropOp;
            ctx.fillStyle = '#cc1111';
            drawTeardrop(ctx, cx, cy, drop.size);
          }
        }
        ctx.restore();

        // ── 4. Wolf eyes ──
        const eyeOpacity = 0.3 + eyePulse * 0.5;
        if (eyeOpacity > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.filter = 'blur(8px)';
          ctx.globalAlpha = eyeOpacity;
          // Left eye
          const eyeGrad1 = ctx.createRadialGradient(
            centerX - cardWidth * 0.12,
            cardHeight * 0.3,
            0,
            centerX - cardWidth * 0.12,
            cardHeight * 0.3,
            12,
          );
          eyeGrad1.addColorStop(0, primaryColor);
          eyeGrad1.addColorStop(1, hexWithAlpha(primaryColor, 0));
          ctx.fillStyle = eyeGrad1;
          ctx.beginPath();
          ctx.arc(centerX - cardWidth * 0.12, cardHeight * 0.3, 12, 0, Math.PI * 2);
          ctx.fill();
          // Right eye
          const eyeGrad2 = ctx.createRadialGradient(
            centerX + cardWidth * 0.12,
            cardHeight * 0.3,
            0,
            centerX + cardWidth * 0.12,
            cardHeight * 0.3,
            12,
          );
          eyeGrad2.addColorStop(0, primaryColor);
          eyeGrad2.addColorStop(1, hexWithAlpha(primaryColor, 0));
          ctx.fillStyle = eyeGrad2;
          ctx.beginPath();
          ctx.arc(centerX + cardWidth * 0.12, cardHeight * 0.3, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── 5. Shockwave rings ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Wave 1
        const wave1R = progress * cardWidth * 0.8;
        const wave1Op = Math.max(0, 0.5 - progress * 0.7);
        if (wave1Op > 0) {
          ctx.globalAlpha = wave1Op;
          ctx.filter = 'blur(4px)';
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, wave1R, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Wave 2
        const wave2P = Math.max(0, progress - 0.15);
        const wave2R = wave2P * cardWidth * 0.9;
        const wave2Op = Math.max(0, 0.3 - wave2P * 0.5);
        if (wave2Op > 0) {
          ctx.globalAlpha = wave2Op;
          ctx.filter = 'blur(3px)';
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, wave2R, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // ── 6. Spark fragments ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = `blur(${PARTICLE_BLUR}px)`;
        for (const s of SPARKS) {
          const lp = Math.min(1, Math.max(0, (progress - s.delay) / 0.35));
          if (lp <= 0) continue;
          const cx = centerX + s.targetXRatio * cardWidth * lp;
          const cy = centerY + s.targetYRatio * cardWidth * lp;
          let opacity: number;
          if (lp < 0.05) opacity = lp / 0.05;
          else opacity = Math.max(0, 1 - (lp - 0.05) / 0.6);
          const r = Math.max(1, s.sizeRatio * cardWidth) * Math.max(0, 1 - lp);
          if (r <= 0 || opacity <= 0) continue;
          ctx.globalAlpha = opacity;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });

    return cleanup;
  }, [animate, cardWidth, cardHeight, primaryColor, glowColor]);

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

/** Draw a teardrop shape (narrow top, bulbous bottom) */
function drawTeardrop(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const tipY = cy - r * 2.2;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.8, cx + r, cy + r * 0.2);
  ctx.arc(cx, cy + r * 0.2, r, 0, Math.PI, false);
  ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.8, cx, tipY);
  ctx.closePath();
  ctx.fill();
}
