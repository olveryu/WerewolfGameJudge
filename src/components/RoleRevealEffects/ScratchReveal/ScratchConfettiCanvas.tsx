'use dom';

/**
 * ScratchConfettiCanvas — 刮刮卡揭示后的彩纸礼花爆发
 *
 * 20 个彩色圆点从中心向外扩散，带 1px blur。
 * trigger=true 时播放一次动画（~800ms），播完自动停止。
 */
import { useEffect, useRef } from 'react';

// ─── Confetti particles (deterministic, same as original) ──────────────
const CONFETTI_COLORS = ['#ffd700', '#ff69b4', '#00e5ff', '#66ff66'];

const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  angle: (Math.PI * 2 * i) / 20 + (((i * 37) % 10) / 10) * 0.2,
  speed: 50 + ((i * 53) % 50),
  r: 2 + ((i * 23) % 3),
  color: CONFETTI_COLORS[i % 4]!,
}));

const DURATION = 800;
const FADE_START = 500; // start fading at 500ms
const TOTAL = 900; // fully invisible + stop

interface ScratchConfettiCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  trigger: boolean;
}

export default function ScratchConfettiCanvas({
  width,
  height,
  trigger,
}: ScratchConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const t0 = performance.now();
    const cx = width / 2;
    const cy = height / 2;

    function draw(now: number) {
      const elapsed = now - t0;
      if (elapsed > TOTAL) {
        ctx!.clearRect(0, 0, width, height);
        return;
      }

      ctx!.clearRect(0, 0, width, height);
      ctx!.filter = 'blur(1px)';

      const progress = Math.min(1, elapsed / DURATION);
      // Global opacity: full until FADE_START, then fade to 0
      const globalAlpha =
        elapsed < FADE_START ? 1 : Math.max(0, 1 - (elapsed - FADE_START) / (TOTAL - FADE_START));

      for (const p of CONFETTI) {
        const px = cx + Math.cos(p.angle) * p.speed * progress;
        const py = cy + Math.sin(p.angle) * p.speed * progress - 30 * progress;
        ctx!.globalAlpha = globalAlpha;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(px, py, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.filter = 'none';
      ctx!.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
}
