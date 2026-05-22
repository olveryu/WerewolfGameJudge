'use dom';

/**
 * BreathingBorder — Canvas 2D 脉冲辉光边框
 *
 * 翻牌揭示后在卡片周围渲染弥散的能量场光晕。
 * RoundedRect stroke + blur + screen blend mode + 4 颗跑马灯光点。
 * 无限呼吸脉动保持视觉存在感。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef } from 'react';

import { createCanvasLoop } from '../../canvas/createCanvasLoop';

// Config constants (inlined to avoid cross-bundle resolution issues)
const GLOW_PADDING = 8;
const BLUR_RANGE: [number, number] = [8, 16];
const STROKE_RANGE: [number, number] = [4, 8];
const RUNNER_COUNT = 4;
const BORDER_RADIUS = 28;

interface BreathingBorderProps {
  dom?: import('expo/dom').DOMProps;
  color: string;
  glowColor: string;
  cardWidth: number;
  cardHeight: number;
  animate: boolean;
  breathingDuration?: number;
  onComplete?: () => void;
  effectDisplayDuration?: number;
}

export default function BreathingBorder({
  color,
  glowColor,
  cardWidth,
  cardHeight,
  animate,
  breathingDuration = 2500,
  onComplete,
  effectDisplayDuration = 2500,
}: BreathingBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeCalledRef = useRef(false);

  // Fire onComplete after effectDisplayDuration
  useEffect(() => {
    if (!animate || !onComplete) return;
    completeCalledRef.current = false;
    const timer = setTimeout(() => {
      if (!completeCalledRef.current) {
        completeCalledRef.current = true;
        onComplete();
      }
    }, effectDisplayDuration);
    return () => clearTimeout(timer);
  }, [animate, onComplete, effectDisplayDuration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !animate) return;

    const canvasW = cardWidth + GLOW_PADDING * 3;
    const canvasH = cardHeight + GLOW_PADDING * 3;
    const offsetX = GLOW_PADDING;
    const offsetY = GLOW_PADDING;
    const rectW = cardWidth + GLOW_PADDING;
    const rectH = cardHeight + GLOW_PADDING;
    const perimeter = 2 * rectW + 2 * rectH;
    const runnerDuration = breathingDuration * 2;

    const cleanup = createCanvasLoop({
      canvas,
      width: canvasW,
      height: canvasH,
      draw(ctx, elapsed) {
        // Breathing oscillation (0→1→0 cycle)
        const breathPhase = (elapsed % breathingDuration) / breathingDuration;
        const breathe = Math.sin(breathPhase * Math.PI);

        const blurVal = BLUR_RANGE[0] + breathe * (BLUR_RANGE[1] - BLUR_RANGE[0]);
        const strokeW = STROKE_RANGE[0] + breathe * (STROKE_RANGE[1] - STROKE_RANGE[0]);
        const borderOpacity = 0.4 + breathe * 0.4;

        // ── Main breathing border ──
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = borderOpacity;
        ctx.filter = `blur(${blurVal}px)`;
        ctx.beginPath();
        roundRectPath(ctx, offsetX, offsetY, rectW, rectH, BORDER_RADIUS);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeW;
        ctx.stroke();
        ctx.restore();

        // ── Runner light orbs ──
        const runnerT = (elapsed % runnerDuration) / runnerDuration;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(6px)';
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < RUNNER_COUNT; i++) {
          const phase = i / RUNNER_COUNT;
          const t = ((runnerT + phase) % 1) * perimeter;
          const pos = perimeterToXY(t, offsetX, offsetY, rectW, rectH);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = glowColor;
          ctx.fill();
        }
        ctx.restore();
      },
    });

    return cleanup;
  }, [animate, cardWidth, cardHeight, color, glowColor, breathingDuration]);

  const canvasW = cardWidth + GLOW_PADDING * 3;
  const canvasH = cardHeight + GLOW_PADDING * 3;

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: canvasW,
        height: canvasH,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}

function perimeterToXY(
  t: number,
  offsetX: number,
  offsetY: number,
  rectW: number,
  rectH: number,
): { x: number; y: number } {
  if (t < rectW) {
    return { x: offsetX + t, y: offsetY };
  } else if (t < rectW + rectH) {
    return { x: offsetX + rectW, y: offsetY + (t - rectW) };
  } else if (t < 2 * rectW + rectH) {
    return { x: offsetX + rectW - (t - rectW - rectH), y: offsetY + rectH };
  } else {
    return { x: offsetX, y: offsetY + rectH - (t - 2 * rectW - rectH) };
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}
