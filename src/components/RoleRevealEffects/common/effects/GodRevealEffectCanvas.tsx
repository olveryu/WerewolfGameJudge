'use dom';

/**
 * GodRevealEffect — Canvas 2D 神职阵营揭示特效
 *
 * 翻牌后在卡片区域渲染圣光系列动画：
 * 1. 卡片光晕 — RadialGradient + blur，极亮爆发→持续微弱金色发光
 * 2. 天降光柱 — 从卡片顶部向上延伸的矩形光束（screen blend）
 * 3. 十字闪光 — 水平/垂直 Rect + blur + screen，快闪后消失
 * 4. 光环绽放 — 4 层同心 Circle stroke 从中心扩散
 * 5. 圣光粒子 — 24 颗金色光尘从中心向四周飘散
 * 6. 底部光晕 — 地面反射的半圆形柔光
 *
 * 情绪签名：瞬间爆发 + "divine intervention" 力量感。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// ─── Constants ────────────────────────────────────────────────────────

const EFFECT_START_DELAY = 100;
const MAIN_DURATION = 2500;
const PARTICLE_START_DELAY = 400;
const PARTICLE_LIFETIME = 5500;
const TWINKLE_CYCLE = 1047;
const GLOW_BLUR = 12;
const PARTICLE_BLUR = 3;

const HALO_CONFIGS = [
  { startP: 0.06, durationP: 0.4 },
  { startP: 0.12, durationP: 0.48 },
  { startP: 0.18, durationP: 0.56 },
  { startP: 0.25, durationP: 0.6 },
] as const;

const PARTICLE_COUNT = 24;
const GOD_PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 100) / 100;
  const r2 = ((i * 41 + 31) % 100) / 100;
  const r3 = ((i * 59 + 7) % 100) / 100;
  const r4 = ((i * 37 + 53) % 100) / 100;
  const angle = ((i * 29 + 11) % 360) * (Math.PI / 180);
  const dist = 20 + r1 * 120;
  return {
    angle,
    dist,
    driftX: (r2 - 0.5) * 40,
    driftY: -20 - r3 * 60,
    size: 1 + r4 * 2.5,
    baseAlpha: 0.3 + ((i * 67 + 23) % 70) / 100,
    twinklePhase: ((i * 83 + 11) % 628) / 100,
  };
});

// ─── Easing helpers ───────────────────────────────────────────────────

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ─── Glow intensity timeline ─────────────────────────────────────────
// Burst 0→1 (375ms easeOutCubic) → 1→0.6 (625ms) → 0.6→0.35 (1500ms)
function computeGlowIntensity(t: number): number {
  if (t < 375) return easeOutCubic(t / 375);
  if (t < 1000) return 1 - 0.4 * easeOutQuad((t - 375) / 625);
  if (t < 2500) return 0.6 - 0.25 * easeOutQuad((t - 1000) / 1500);
  return 0.35;
}

// ─── Component ────────────────────────────────────────────────────────

interface GodRevealEffectCanvasProps {
  dom?: import('expo/dom').DOMProps;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  primaryColor: string;
  glowColor: string;
  particleColor: string;
}

export default function GodRevealEffectCanvas({
  cardWidth,
  cardHeight,
  animate,
  primaryColor,
  glowColor,
  particleColor,
}: GodRevealEffectCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const centerX = cardWidth / 2;
    const centerY = cardHeight * 0.42;
    const barThickness = Math.max(3, cardWidth * 0.025);

    const cleanup = createCanvasLoop({
      canvas,
      width: cardWidth,
      height: cardHeight,
      draw(ctx, elapsed) {
        const t = elapsed - EFFECT_START_DELAY;
        if (t < 0) return;

        // Progress: 0→1 over MAIN_DURATION with easeOutQuad
        const progress = Math.min(1, easeOutQuad(Math.min(t / MAIN_DURATION, 1)));

        // ── 1. Card glow (radial gradient + blur) ──
        const glowI = computeGlowIntensity(t);
        const glowR = cardWidth * 0.5 * (0.5 + glowI * 0.5);
        const glowOpacity = glowI * 0.7;

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

        // ── 2. Light pillar ──
        const pillarP = Math.min(t / MAIN_DURATION, 1);
        const pillarOpacity = pillarP < 0.05 ? pillarP / 0.05 : pillarP < 0.3 ? 1 : Math.max(0.15, 1 - (pillarP - 0.3) / 0.7);
        const pillarHeight = Math.min(1, pillarP / 0.15) * cardHeight * 0.8;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = pillarOpacity;
        ctx.filter = 'blur(15px)';
        ctx.fillStyle = primaryColor;
        ctx.fillRect(centerX - cardWidth * 0.15, 0, cardWidth * 0.3, pillarHeight);
        ctx.restore();

        // ── 3. Cross flash ──
        const crossP = Math.min(t / MAIN_DURATION, 1);
        const crossOpacity = crossP < 0.08 ? crossP / 0.08 : Math.max(0, 1 - (crossP - 0.08) / 0.3);
        if (crossOpacity > 0.01) {
          const scaleX = Math.min(2, (crossP / 0.08) * 2);
          const scaleY = Math.min(2, (crossP / 0.08) * 2);

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = crossOpacity;
          ctx.filter = 'blur(10px)';
          // Horizontal bar
          ctx.fillStyle = particleColor;
          const hW = cardWidth * 2 * scaleX;
          ctx.fillRect(centerX - hW / 2, centerY - barThickness / 2, hW, barThickness);
          // Vertical bar
          const vH = cardHeight * 2 * scaleY;
          ctx.fillRect(centerX - barThickness / 2, centerY - vH / 2, barThickness, vH);
          ctx.restore();
        }

        // ── 4. Expanding halos ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(6px)';
        for (const cfg of HALO_CONFIGS) {
          const endP = cfg.startP + cfg.durationP;
          const lp = Math.min(1, Math.max(0, (progress - cfg.startP) / (endP - cfg.startP)));
          if (lp <= 0) continue;
          const maxR = cardWidth * 0.8;
          const r = lp * maxR;
          const opacity = lp < 0.3 ? 0.8 : Math.max(0, 0.8 * (1 - (lp - 0.3) / 0.7));
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        // ── 5. Gold particles ──
        const particleT = t - PARTICLE_START_DELAY;
        if (particleT > 0) {
          const pProgress = Math.min(1, particleT / PARTICLE_LIFETIME);
          const twinkleVal = ((particleT % TWINKLE_CYCLE) / TWINKLE_CYCLE) * Math.PI * 2;
          const life = 1 - pProgress;

          if (life > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.filter = `blur(${PARTICLE_BLUR}px)`;
            for (const p of GOD_PARTICLES) {
              const startX = centerX + Math.cos(p.angle) * p.dist * 0.3;
              const startY = centerY + Math.sin(p.angle) * p.dist * 0.3;
              const cx = startX + p.driftX * pProgress;
              const cy = startY + p.driftY * pProgress;
              const flicker = 0.5 + 0.5 * Math.sin(twinkleVal + p.twinklePhase);
              const opacity = p.baseAlpha * life * flicker;
              ctx.globalAlpha = opacity;
              ctx.fillStyle = particleColor;
              ctx.beginPath();
              ctx.arc(cx, cy, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        // ── 6. Bottom ground glow ──
        const groundP = Math.min(t / MAIN_DURATION, 1);
        const groundOpacity = groundP < 0.2 ? (groundP / 0.2) * 0.25 : 0.25;
        ctx.save();
        ctx.globalAlpha = groundOpacity;
        ctx.filter = 'blur(20px)';
        const groundR = cardWidth * 0.6;
        const gGrad = ctx.createRadialGradient(centerX, cardHeight, 0, centerX, cardHeight, groundR);
        gGrad.addColorStop(0, hexWithAlpha(primaryColor, 0.25));
        gGrad.addColorStop(1, hexWithAlpha(primaryColor, 0));
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(centerX, cardHeight, groundR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });

    return cleanup;
  }, [animate, cardWidth, cardHeight, primaryColor, glowColor, particleColor]);

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

// ─── Utility ──────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  // Handle both #RRGGBB and #RRGGBBAA
  return hex.slice(0, 7) + a;
}
