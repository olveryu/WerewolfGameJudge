'use dom';

/**
 * TarotSceneCanvas — 塔罗牌占卜场景视觉层（Canvas 2D）
 *
 * 星空 + 水晶球 + 蜡烛 + 魔法阵 + 拖尾光弧。
 * 纯装饰性动画，不含交互。
 */
import { useEffect, useRef } from 'react';

const TAROT_COLORS = {
  starfield: '#c8c8ff',
  candleYellow: '#ffe066',
  candleOrange: '#ff9933',
  crystalBall: '#6644aa',
  magicCircle: '#c9a84c',
  gold: '#d4af37',
  goldGlow: '#ffd700',
};

interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: boolean;
  phase: number;
}

function createStars(w: number, h: number): Star[] {
  return Array.from({ length: 30 }, (_, i) => ({
    x: (((i * 73 + 17) % 100) / 100) * w,
    y: (((i * 41 + 31) % 100) / 100) * h * 0.65,
    r: 0.5 + (((i * 59 + 7) % 100) / 100) * 1.2,
    twinkle: i < 5,
    phase: ((i * 83 + 11) % 628) / 100,
  }));
}

function buildHexagramPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  // Two overlapping triangles
  for (let t = 0; t < 2; t++) {
    const offset = t * (Math.PI / 6);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = offset + (Math.PI * 2 * i) / 3 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

interface TarotSceneCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  phase: 'waiting' | 'drawing' | 'flipping' | 'revealed' | 'hidden';
  /** performance.now() when flip started, for magic circle timing */
  flipStartTime: number;
  /** performance.now() when drawing started, for trail */
  drawStartTime: number;
  magicCircleCx: number;
  magicCircleCy: number;
  magicCircleRadius: number;
}

export default function TarotSceneCanvas({
  width,
  height,
  phase,
  flipStartTime,
  drawStartTime,
  magicCircleCx,
  magicCircleCy,
  magicCircleRadius,
}: TarotSceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const starsRef = useRef(createStars(width, height));

  useEffect(() => {
    starsRef.current = createStars(width, height);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const t0 = performance.now();

    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height);
      const t = (now - t0) / 1000;

      // ── Stars ──
      const starCycle = (t / 6) * Math.PI * 2;
      for (const star of starsRef.current) {
        const op = star.twinkle
          ? 0.3 + Math.sin(starCycle + star.phase) * 0.3
          : 0.35;
        ctx!.globalAlpha = op;
        ctx!.fillStyle = TAROT_COLORS.starfield;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx!.fill();

        // Sparkle cross for twinkling stars
        if (star.twinkle && star.r > 1.0) {
          ctx!.strokeStyle = TAROT_COLORS.starfield;
          ctx!.lineWidth = 1;
          ctx!.lineCap = 'round';
          const r2 = star.r * 2;
          ctx!.beginPath();
          ctx!.moveTo(star.x, star.y - r2);
          ctx!.lineTo(star.x, star.y + r2);
          ctx!.stroke();
          ctx!.beginPath();
          ctx!.moveTo(star.x - r2, star.y);
          ctx!.lineTo(star.x + r2, star.y);
          ctx!.stroke();
        }
      }

      // ── Crystal ball (top center) ──
      const cbX = width / 2;
      const cbY = height * 0.18;
      const crystalPulse = (Math.sin(t * 0.4 * Math.PI * 2) + 1) / 2;

      // Outer glow
      ctx!.globalAlpha = 0.3;
      ctx!.filter = 'blur(12px)';
      const glowGrad = ctx!.createRadialGradient(cbX, cbY, 0, cbX, cbY, 36);
      glowGrad.addColorStop(0, `${TAROT_COLORS.crystalBall}40`);
      glowGrad.addColorStop(1, `${TAROT_COLORS.crystalBall}00`);
      ctx!.fillStyle = glowGrad;
      ctx!.beginPath();
      ctx!.arc(cbX, cbY, 36, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.filter = 'none';

      // Ball body
      ctx!.globalAlpha = 1;
      const bodyGrad = ctx!.createRadialGradient(cbX - 5, cbY - 5, 0, cbX, cbY, 22);
      bodyGrad.addColorStop(0, '#443388');
      bodyGrad.addColorStop(1, '#1a0a2e');
      ctx!.fillStyle = bodyGrad;
      ctx!.beginPath();
      ctx!.arc(cbX, cbY, 22, 0, Math.PI * 2);
      ctx!.fill();

      // Inner fog glow
      const innerR = 28 + crystalPulse * 4;
      ctx!.globalAlpha = 0.2 + crystalPulse * 0.15;
      ctx!.filter = 'blur(6px)';
      const fogGrad = ctx!.createRadialGradient(cbX, cbY, 0, cbX, cbY, innerR);
      fogGrad.addColorStop(0, `${TAROT_COLORS.crystalBall}80`);
      fogGrad.addColorStop(1, `${TAROT_COLORS.crystalBall}00`);
      ctx!.fillStyle = fogGrad;
      ctx!.beginPath();
      ctx!.arc(cbX, cbY, innerR, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.filter = 'none';

      // Glass highlight
      ctx!.globalAlpha = 0.25;
      ctx!.filter = 'blur(2px)';
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(cbX - 7, cbY - 7, 5, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.filter = 'none';

      // Base
      ctx!.globalAlpha = 0.6;
      ctx!.fillStyle = '#332244';
      ctx!.beginPath();
      ctx!.arc(cbX, cbY + 22, 8, 0, Math.PI * 2);
      ctx!.fill();

      // ── Candles ──
      const candleFlicker = (t / 0.8) * Math.PI * 2;
      const drawCandle = (cx: number, baseY: number, flickerOffset: number) => {
        // Body
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = '#e8d8b8';
        ctx!.beginPath();
        ctx!.arc(cx, baseY, 5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = '#e0c8a0';
        ctx!.beginPath();
        ctx!.arc(cx, baseY + 8, 5, 0, Math.PI * 2);
        ctx!.fill();

        // Flame
        const fy = baseY - 14 - Math.sin(candleFlicker * flickerOffset) * 2;
        const fOp = 0.7 + Math.sin(candleFlicker * flickerOffset * 2.1) * 0.2;
        ctx!.globalAlpha = fOp;
        ctx!.filter = 'blur(4px)';
        const fGrad = ctx!.createRadialGradient(cx, fy, 0, cx, fy, 8);
        fGrad.addColorStop(0, TAROT_COLORS.candleYellow);
        fGrad.addColorStop(0.6, TAROT_COLORS.candleOrange);
        fGrad.addColorStop(1, '#ff440000');
        ctx!.fillStyle = fGrad;
        ctx!.beginPath();
        ctx!.arc(cx, fy, 6, 0, Math.PI * 2);
        ctx!.fill();

        // Glow
        ctx!.globalAlpha = 0.12;
        ctx!.filter = 'blur(8px)';
        const glowG = ctx!.createRadialGradient(cx, baseY - 14, 0, cx, baseY - 14, 16);
        glowG.addColorStop(0, TAROT_COLORS.candleYellow);
        glowG.addColorStop(1, '#00000000');
        ctx!.fillStyle = glowG;
        ctx!.beginPath();
        ctx!.arc(cx, baseY - 14, 16, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
      };

      drawCandle(width * 0.12, height * 0.35, 1);
      drawCandle(width * 0.88, height * 0.35, 1.3);

      // ── Magic circle (during flip/revealed briefly) ──
      if ((phase === 'flipping' || phase === 'revealed') && flipStartTime > 0) {
        const elapsed = (now - flipStartTime) / 1000;
        let mcOp: number;
        if (phase === 'flipping') {
          mcOp = Math.min(0.5, elapsed * 1.5);
        } else {
          // Fade out in revealed
          mcOp = Math.max(0, 0.5 - (elapsed - 0.8) * 0.8);
        }

        if (mcOp > 0) {
          const rotation = elapsed * (Math.PI * 2) / 5; // 5s per revolution
          ctx!.globalAlpha = mcOp;
          ctx!.save();
          ctx!.translate(magicCircleCx, magicCircleCy);
          ctx!.rotate(rotation);
          ctx!.translate(-magicCircleCx, -magicCircleCy);

          // Outer ring
          ctx!.filter = 'blur(2px)';
          ctx!.strokeStyle = TAROT_COLORS.magicCircle;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.arc(magicCircleCx, magicCircleCy, magicCircleRadius, 0, Math.PI * 2);
          ctx!.stroke();

          // Inner ring
          ctx!.filter = 'blur(1px)';
          ctx!.lineWidth = 0.8;
          ctx!.beginPath();
          ctx!.arc(magicCircleCx, magicCircleCy, magicCircleRadius * 0.7, 0, Math.PI * 2);
          ctx!.stroke();

          // Hexagram
          ctx!.filter = 'blur(1.5px)';
          ctx!.lineWidth = 1;
          buildHexagramPath(ctx!, magicCircleCx, magicCircleCy, magicCircleRadius);
          ctx!.filter = 'none';

          // 6 dots
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const px = magicCircleCx + Math.cos(angle) * magicCircleRadius * 0.85;
            const py = magicCircleCy + Math.sin(angle) * magicCircleRadius * 0.85;
            ctx!.filter = 'blur(2px)';
            ctx!.fillStyle = TAROT_COLORS.gold;
            ctx!.beginPath();
            ctx!.arc(px, py, 2, 0, Math.PI * 2);
            ctx!.fill();
          }
          ctx!.filter = 'none';
          ctx!.restore();
        }
      }

      // ── Trail light (during drawing) ──
      if (phase === 'drawing' && drawStartTime > 0) {
        const elapsed = (now - drawStartTime) / 1000;
        let trOp: number;
        if (elapsed < 0.1) trOp = elapsed * 7;
        else if (elapsed < 0.5) trOp = 0.7;
        else trOp = Math.max(0, 0.7 - (elapsed - 0.5) * 2.3);

        if (trOp > 0) {
          ctx!.globalAlpha = trOp;
          ctx!.globalCompositeOperation = 'screen';
          ctx!.filter = 'blur(6px)';
          ctx!.strokeStyle = TAROT_COLORS.goldGlow;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.moveTo(width / 2, height / 2 - 130); // approximate wheel radius
          ctx!.lineTo(width / 2, height / 2);
          ctx!.stroke();
          ctx!.filter = 'none';
          ctx!.globalCompositeOperation = 'source-over';
        }
      }

      ctx!.globalAlpha = 1;

      if (phase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, phase, flipStartTime, drawStartTime, magicCircleCx, magicCircleCy, magicCircleRadius]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    />
  );
}
