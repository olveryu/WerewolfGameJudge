'use dom';

/**
 * ThirdRevealEffect — Canvas 2D 第三方阵营揭示特效
 *
 * 翻牌后在卡片区域渲染神秘系列动画：
 * 1. 卡片光晕 — RadialGradient + blur，极亮爆发→持续微弱紫色发光
 * 2. 旋转符文环（2 层）— 虚线圆弧，持续旋转
 * 3. 螺旋轨道粒子（30 颗）— Circle + blur + screen，绕中心公转
 * 4. 召唤闪电弧（6 条）— 折线 path + blur，从中心向外辐射
 * 5. 中心能量核心 — Circle + RadialGradient + blur 脉动
 *
 * 符文环和粒子持续循环，光晕持续保留。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const EFFECT_START_DELAY = 100;
const MAIN_DURATION = 2500;
const GLOW_BLUR = 12;
const PARTICLE_BLUR = 3;
const PARTICLE_COUNT = 30;
const OUTER_ROTATION_DURATION = 12000;
const INNER_ROTATION_DURATION = 8000;
const ORBIT_DURATION = 6000;
const TWINKLE_CYCLE = 1200;
const CORE_PULSE_DURATION = 3000; // 1500 up + 1500 down

const ORBIT_PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  return {
    phaseOffset: (i / PARTICLE_COUNT) * 360,
    radiusOffsetRatio: 0.17 * ((i % 3) - 1),
    sizeRatio: (2 + (i % 2)) / 140,
    driftY: (r1 - 0.5) * 8,
    twinklePhase: r2 * Math.PI * 2,
  };
});

const ARC_COUNT = 6;
const ARCS = Array.from({ length: ARC_COUNT }, (_, i) => {
  const angle = (i / ARC_COUNT) * Math.PI * 2;
  return { angle, lengthRatio: 0.25 + ((i * 37 + 11) % 20) / 100 };
});

// ─── Easing helpers ───────────────────────────────────────────────────

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Glow: burst 0→1 (375ms) → 1→0.6 (625ms) → 0.6→0.3 (1500ms)
function computeGlowIntensity(t: number): number {
  if (t < 375) return easeOutCubic(t / 375);
  if (t < 1000) return 1 - 0.4 * easeOutQuad((t - 375) / 625);
  if (t < 2500) return 0.6 - 0.3 * easeOutQuad((t - 1000) / 1500);
  return 0.3;
}

// Appear: starts at +300ms, 0→1 over 500ms
function computeAppear(t: number): number {
  const at = t - 300;
  if (at <= 0) return 0;
  return Math.min(1, easeOutQuad(at / 500));
}

// Core pulse: starts at +500ms, oscillates 0→1→0 over 3000ms
function computeCorePulse(t: number): number {
  const ct = t - 500;
  if (ct <= 0) return 0;
  const phase = (ct % CORE_PULSE_DURATION) / CORE_PULSE_DURATION;
  // 0→0.5: go up. 0.5→1: go down
  return phase < 0.5 ? easeInOutQuad(phase * 2) : easeInOutQuad((1 - phase) * 2);
}

// ─── Component ────────────────────────────────────────────────────────

interface ThirdRevealEffectCanvasProps {
  dom?: import('expo/dom').DOMProps;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export default function ThirdRevealEffectCanvas({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}: ThirdRevealEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const centerX = cardWidth / 2;
    const centerY = cardHeight * 0.42;
    const outerRingR = cardWidth * 0.52;
    const innerRingR = outerRingR * 0.82;
    const baseRadius = cardWidth * 0.35;

    // Pre-compute lightning arc segments
    const arcPaths = ARCS.map(({ angle, lengthRatio }) => {
      const arcLength = cardWidth * lengthRatio;
      const segments = 5;
      const segLen = arcLength / segments;
      const points: Array<{ x: number; y: number }> = [{ x: centerX, y: centerY }];
      for (let s = 1; s <= segments; s++) {
        const dist = segLen * s;
        const jag = (((s * 37 + Math.round(angle * 10)) % 20) - 10) * 0.3;
        points.push({
          x: centerX + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * jag,
          y: centerY + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * jag,
        });
      }
      return points;
    });

    const cleanup = createCanvasLoop({
      canvas,
      width: cardWidth,
      height: cardHeight,
      draw(ctx, elapsed) {
        const t = elapsed - EFFECT_START_DELAY;
        if (t < 0) return;

        const _progress = Math.min(1, easeOutQuad(Math.min(t / MAIN_DURATION, 1)));
        const appear = computeAppear(t);
        const glowI = computeGlowIntensity(t);
        const corePulse = computeCorePulse(t);

        // ── 1. Card glow ──
        const glowR = cardWidth * 0.5 * (0.5 + glowI * 0.5);
        const glowOpacity = glowI * 0.65;

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

        // ── 2. Lightning arcs ──
        const rawP = Math.min(t / MAIN_DURATION, 1);
        let arcOpacity: number;
        if (rawP < 0.05) arcOpacity = (rawP / 0.05) * 0.6;
        else if (rawP < 0.2) arcOpacity = 0.6;
        else arcOpacity = Math.max(0, 0.6 * (1 - (rawP - 0.2) / 0.3));

        if (arcOpacity > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = arcOpacity;
          ctx.filter = 'blur(2px)';
          ctx.strokeStyle = particleColor;
          ctx.lineWidth = 1.5;
          for (const points of arcPaths) {
            ctx.beginPath();
            ctx.moveTo(points[0]!.x, points[0]!.y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i]!.x, points[i]!.y);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        // ── 3. Rune rings (dashed arcs) ──
        if (appear > 0) {
          const outerAngle =
            ((t % OUTER_ROTATION_DURATION) / OUTER_ROTATION_DURATION) * Math.PI * 2;
          const innerAngle =
            -((t % INNER_ROTATION_DURATION) / INNER_ROTATION_DURATION) * Math.PI * 2;

          ctx.save();
          ctx.globalAlpha = appear * 0.7;
          ctx.filter = 'blur(1px)';
          // Outer ring
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.setLineDash([6, 12]);
          ctx.lineDashOffset = -outerAngle * outerRingR;
          ctx.beginPath();
          ctx.arc(centerX, centerY, outerRingR, 0, Math.PI * 2);
          ctx.stroke();
          // Inner ring
          ctx.strokeStyle = primaryColor;
          ctx.setLineDash([3, 8]);
          ctx.lineDashOffset = -innerAngle * innerRingR;
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerRingR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // ── 4. Central energy core ──
        if (appear > 0) {
          const coreOpacity = appear * (0.4 + corePulse * 0.3);
          const coreR = cardWidth * 0.06 * (0.7 + corePulse * 0.3);
          const coreGlowR = cardWidth * 0.15 * (0.6 + corePulse * 0.4);

          ctx.save();
          ctx.globalAlpha = coreOpacity;
          // Core glow
          ctx.filter = 'blur(10px)';
          const cGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreGlowR);
          cGrad.addColorStop(0, hexWithAlpha(glowColor, 0.5));
          cGrad.addColorStop(1, hexWithAlpha(primaryColor, 0));
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreGlowR, 0, Math.PI * 2);
          ctx.fill();
          // Core orb
          ctx.filter = 'blur(4px)';
          ctx.fillStyle = glowColor;
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ── 5. Orbit particles ──
        if (appear > 0) {
          const orbitAngle = ((t % ORBIT_DURATION) / ORBIT_DURATION) * 360;
          const twinkleVal = ((t % TWINKLE_CYCLE) / TWINKLE_CYCLE) * Math.PI * 2;

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.filter = `blur(${PARTICLE_BLUR}px)`;
          for (const p of ORBIT_PARTICLES) {
            const radiusOffset = p.radiusOffsetRatio * baseRadius;
            const size = Math.max(1, p.sizeRatio * cardWidth);
            const wiggleAmp = cardWidth * 0.057;
            const angleDeg = orbitAngle + p.phaseOffset;
            const angleRad = (angleDeg * Math.PI) / 180;
            const r = baseRadius + radiusOffset + Math.sin(angleRad * 3) * wiggleAmp;
            const cx = Math.cos(angleRad) * r + centerX;
            const cy = Math.sin(angleRad) * r + centerY + p.driftY;
            const flicker = 0.5 + 0.5 * Math.sin(twinkleVal + p.twinklePhase);
            const opacity = appear * 0.7 * flicker;
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

// ─── Utility ──────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.slice(0, 7) + a;
}
