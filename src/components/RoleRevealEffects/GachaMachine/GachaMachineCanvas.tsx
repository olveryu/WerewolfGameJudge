'use dom';

/**
 * GachaMachineCanvas — 扭蛋机旋转灯 + 星星纷飞（Canvas 2D）
 *
 * 两个视觉层：
 * 1. Rotary lights: 8 个脉冲发光圆点围绕机身
 * 2. Confetti stars: 揭示后 16 个星形粒子向外扩散
 */
import { useEffect, useRef } from 'react';

interface RotaryLight {
  x: number;
  y: number;
  color: string;
  phase: number;
}

interface ConfettiStar {
  angle: number;
  speed: number;
  r: number;
  color: string;
}

interface GachaMachineCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  rotaryLights: RotaryLight[];
  confettiStars: ConfettiStar[];
  phase: 'active' | 'revealed' | 'hidden';
  /** performance.now() when confetti starts */
  confettiStartTime: number;
  confettiDuration: number;
}

export default function GachaMachineCanvas({
  width,
  height,
  rotaryLights,
  confettiStars,
  phase,
  confettiStartTime,
  confettiDuration,
}: GachaMachineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

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

      // ── Rotary lights (cycling glow) ──
      const cycle = t * 2; // ~2 full cycles per second
      ctx!.filter = 'blur(4px)';
      for (const light of rotaryLights) {
        const opacity = 0.3 + Math.sin(cycle + light.phase) * 0.3;
        ctx!.globalAlpha = opacity;
        ctx!.fillStyle = light.color;
        ctx!.beginPath();
        ctx!.arc(light.x, light.y, 6, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.filter = 'none';

      // ── Confetti stars (during reveal) ──
      if (phase === 'revealed' && confettiStartTime > 0) {
        const elapsed = now - confettiStartTime;
        const progress = Math.min(1, elapsed / confettiDuration);
        const opacity = Math.max(0, 1 - progress * 1.2);

        if (opacity > 0) {
          ctx!.filter = 'blur(1px)';
          ctx!.globalAlpha = opacity;
          for (const star of confettiStars) {
            const sx = width / 2 + Math.cos(star.angle) * star.speed * progress;
            const sy = height / 2 + Math.sin(star.angle) * star.speed * progress - 20 * progress;
            ctx!.fillStyle = star.color;
            ctx!.beginPath();
            ctx!.arc(sx, sy, star.r, 0, Math.PI * 2);
            ctx!.fill();
          }
          ctx!.filter = 'none';
        }
      }

      ctx!.globalAlpha = 1;

      if (phase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, rotaryLights, confettiStars, phase, confettiStartTime, confettiDuration]);

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
