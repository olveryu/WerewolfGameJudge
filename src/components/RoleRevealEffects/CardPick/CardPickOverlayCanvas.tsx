'use dom';

/**
 * CardPickOverlayCanvas — Canvas 2D 抽牌场景装饰层
 *
 * 散落筹码 + 充能光环脉冲 + 翻牌侧光条扫过。
 * 不 import service，不含业务逻辑。
 */
import { useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const CHIP_COLORS = ['#cc3333', '#3366aa', '#d4af37', '#338844'] as const;

const COLORS = {
  chargeAura: '#d4af37',
  lightBar: '#ffffff',
} as const;

interface ChipData {
  x: number;
  y: number;
  r: number;
  color: string;
}

function createChips(w: number, h: number): ChipData[] {
  return [
    { x: w * 0.08, y: h * 0.15, r: 8, color: CHIP_COLORS[0] },
    { x: w * 0.92, y: h * 0.2, r: 7, color: CHIP_COLORS[1] },
    { x: w * 0.15, y: h * 0.82, r: 9, color: CHIP_COLORS[2] },
    { x: w * 0.88, y: h * 0.78, r: 7, color: CHIP_COLORS[3] },
    { x: w * 0.05, y: h * 0.5, r: 6, color: CHIP_COLORS[0] },
    { x: w * 0.95, y: h * 0.45, r: 8, color: CHIP_COLORS[1] },
    { x: w * 0.2, y: h * 0.12, r: 6, color: CHIP_COLORS[2] },
    { x: w * 0.82, y: h * 0.88, r: 7, color: CHIP_COLORS[3] },
  ];
}

// ─── Component ────────────────────────────────────────────────────────

interface CardPickOverlayCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  /** 'idle' = just chips; 'charging' = aura pulse; 'flipping' = light bars; 'done' = nothing */
  phase: 'idle' | 'charging' | 'flipping' | 'done';
}

export default function CardPickOverlayCanvas({
  width,
  height,
  phase,
}: CardPickOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chipsRef = useRef<ChipData[]>([]);
  const rafRef = useRef<number>(0);
  const [internalPhase, setInternalPhase] = useState(phase);
  const phaseStartRef = useRef(0);

  useEffect(() => {
    chipsRef.current = createChips(width, height);
  }, [width, height]);

  useEffect(() => {
    setInternalPhase(phase);
    phaseStartRef.current = performance.now();
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height);

      // ── Static chips ──
      for (const chip of chipsRef.current) {
        // Chip body
        ctx!.globalAlpha = 0.5;
        ctx!.fillStyle = chip.color;
        ctx!.beginPath();
        ctx!.arc(chip.x, chip.y, chip.r, 0, Math.PI * 2);
        ctx!.fill();

        // Inner ring
        ctx!.globalAlpha = 0.15;
        ctx!.strokeStyle = '#ffffff';
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(chip.x, chip.y, chip.r * 0.6, 0, Math.PI * 2);
        ctx!.stroke();

        // Center dot
        ctx!.globalAlpha = 0.2;
        ctx!.fillStyle = '#ffffff';
        ctx!.beginPath();
        ctx!.arc(chip.x, chip.y, 1.5, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      const elapsed = now - phaseStartRef.current;

      // ── Charge aura (pulsing ring before flip) ──
      if (internalPhase === 'charging') {
        const cx = width / 2;
        const cy = height / 2;

        // Fade in over 200ms
        const fadeIn = Math.min(1, elapsed / 200) * 0.7;
        // Pulse: 300ms period, oscillates between 0.5-1.0
        const pulse = 0.5 + 0.5 * Math.sin((elapsed / 300) * Math.PI * 2);
        const r = 60 + pulse * 12;

        ctx!.globalAlpha = fadeIn;
        ctx!.filter = 'blur(10px)';
        const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, COLORS.chargeAura + '60');
        grad.addColorStop(1, COLORS.chargeAura + '00');
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
        ctx!.globalAlpha = 1;
      }

      // ── Light bars (sweep during flip) ──
      if (internalPhase === 'flipping') {
        const flipDuration = 600; // matches config.flipDuration
        const progress = Math.min(1, elapsed / flipDuration);

        // Opacity: fade in quickly then fade out at end
        let opacity: number;
        if (progress < 0.25) opacity = (progress / 0.25) * 0.6;
        else if (progress > 0.7) opacity = ((1 - progress) / 0.3) * 0.6;
        else opacity = 0.6;

        if (opacity > 0.01) {
          const lbX = -width * 0.3 + progress * width * 0.6;

          ctx!.globalCompositeOperation = 'screen';

          // Main bar
          ctx!.globalAlpha = opacity * 0.4;
          ctx!.filter = 'blur(6px)';
          ctx!.fillStyle = COLORS.lightBar;
          ctx!.fillRect(lbX, height * 0.25, 4, height * 0.5);

          // Secondary bar
          ctx!.globalAlpha = opacity * 0.2;
          ctx!.filter = 'blur(4px)';
          ctx!.fillRect(lbX + 20, height * 0.3, 2, height * 0.4);

          ctx!.filter = 'none';
          ctx!.globalCompositeOperation = 'source-over';
          ctx!.globalAlpha = 1;
        }
      }

      if (internalPhase !== 'done') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, internalPhase]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
