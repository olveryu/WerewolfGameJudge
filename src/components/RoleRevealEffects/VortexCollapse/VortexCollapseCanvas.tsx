'use dom';

/**
 * VortexCollapseCanvas — Canvas 2D 虚空坍缩视觉 + 画圈交互层
 *
 * 深空星云 + 旋涡中心 + 事件视界 + 螺旋臂 + 轨道粒子 + 碎片 +
 * 进度环 + 爆炸粒子。画圈手势自管理。
 * 不 import service，不含业务逻辑。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const PARTICLE_COUNT = 80;
const DEBRIS_COUNT = 20;
const BURST_PARTICLE_COUNT = 40;
const COLLAPSE_THRESHOLD = 3;
const BURST_DURATION = 1000;

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// Pre-computed data
const ORBITAL_PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r1 = ((i * 73 + 17) % 1000) / 1000;
  const r2 = ((i * 41 + 31) % 1000) / 1000;
  const r3 = ((i * 59 + 7) % 1000) / 1000;
  const r4 = ((i * 83 + 11) % 1000) / 1000;
  const r5 = ((i * 97 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 40 + r2 * 140,
    speed: 0.5 + r3 * 1.5,
    radius: 1 + r4 * 2.5,
    hue: 200 + r5 * 100,
    alpha: 0.3 + r4 * 0.5,
  };
});

const DEBRIS_CHUNKS = Array.from({ length: DEBRIS_COUNT }, (_, i) => {
  const r1 = ((i * 43 + 19) % 1000) / 1000;
  const r2 = ((i * 67 + 37) % 1000) / 1000;
  const r3 = ((i * 89 + 13) % 1000) / 1000;
  const r4 = ((i * 31 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 100 + r2 * 150,
    speed: 0.3 + r3 * 0.9,
    size: 3 + r4 * 5,
    hue: 20 + ((i * 17) % 30),
    alpha: 0.2 + r4 * 0.3,
  };
});

const BURST_PARTICLES = Array.from({ length: BURST_PARTICLE_COUNT }, (_, i) => {
  const angle = (((i * 73 + 17) % 1000) / 1000) * Math.PI * 2;
  const speed = 4 + ((i * 31) % 100) / 10;
  const r1 = ((i * 43 + 19) % 100) / 100;
  return { angle, speed, radius: 2 + r1 * 4, hue: 200 + ((i * 17) % 120) };
});

function createBgStars(w: number, h: number) {
  return Array.from({ length: 60 }, (_, i) => ({
    x: (Math.sin(i * 7.7) * 0.5 + 0.5) * w,
    y: (Math.cos(i * 4.3) * 0.5 + 0.5) * h,
    phase: i,
  }));
}

function createNebulae(w: number, h: number) {
  return [
    { x: w * 0.3, y: h * 0.3, r: 200, hue: 260 },
    { x: w * 0.7, y: h * 0.6, r: 180, hue: 300 },
    { x: w * 0.5, y: h * 0.2, r: 150, hue: 230 },
  ];
}

// ─── Component ────────────────────────────────────────────────────────

interface VortexCollapseCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  phase: 'atmosphere' | 'idle' | 'collapse' | 'hidden';
  onCollapse?: () => void;
}

export default function VortexCollapseCanvas({
  width,
  height,
  phase,
  onCollapse,
}: VortexCollapseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [internalPhase, setInternalPhase] = useState(phase);
  const collapsedRef = useRef(false);

  // Animation state
  const t0Ref = useRef(0);
  const spinRef = useRef(0);
  const spinVelRef = useRef(0);
  const lastAngleRef = useRef<number | null>(null);

  // Pre-computed
  const starsRef = useRef(createBgStars(width, height));
  const nebulaeRef = useRef(createNebulae(width, height));
  const particlesRef = useRef(ORBITAL_PARTICLES.map((p) => ({ ...p })));
  const debrisRef = useRef(DEBRIS_CHUNKS.map((d) => ({ ...d })));

  // Burst timing
  const burstStartRef = useRef(0);

  const cx = width / 2;
  const cy = height * 0.45;

  useEffect(() => {
    starsRef.current = createBgStars(width, height);
    nebulaeRef.current = createNebulae(width, height);
  }, [width, height]);

  useEffect(() => {
    setInternalPhase(phase);
    if (phase === 'idle') {
      t0Ref.current = performance.now();
    }
  }, [phase]);

  // ── Pointer handlers for spin gesture ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (internalPhase !== 'idle') return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      lastAngleRef.current = Math.atan2(py - cy, px - cx);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [internalPhase, cx, cy],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (internalPhase !== 'idle' || lastAngleRef.current === null) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const angle = Math.atan2(py - cy, px - cx);

      let delta = angle - lastAngleRef.current;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;

      spinVelRef.current += Math.abs(delta) * 0.015;
      spinRef.current += Math.abs(delta) / (Math.PI * 2);
      lastAngleRef.current = angle;

      if (spinRef.current >= COLLAPSE_THRESHOLD && !collapsedRef.current) {
        collapsedRef.current = true;
        burstStartRef.current = performance.now();
        setInternalPhase('collapse');
        onCollapse?.();
      }
    },
    [internalPhase, cx, cy, onCollapse],
  );

  const handlePointerUp = useCallback(() => {
    lastAngleRef.current = null;
  }, []);

  // ── Main draw loop ──
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
      const t = (now - t0Ref.current) / 1000;

      // ── Nebulae ──
      for (const neb of nebulaeRef.current) {
        const opacity = 0.08 + Math.sin(t * 0.3 + neb.hue) * 0.03;
        const grad = ctx!.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
        grad.addColorStop(0, hsl(neb.hue, 60, 20, 0.08));
        grad.addColorStop(0.5, hsl(neb.hue, 40, 15, 0.03));
        grad.addColorStop(1, 'transparent');
        ctx!.globalAlpha = opacity;
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Background stars ──
      for (const star of starsRef.current) {
        const alpha = 0.15 + Math.sin(t * 2 + star.phase) * 0.1;
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = 'rgba(180,180,220,0.3)';
        ctx!.fillRect(star.x, star.y, 1, 1);
      }
      ctx!.globalAlpha = 1;

      // ── Vortex visuals (only in idle/collapse) ──
      if (internalPhase === 'idle' || internalPhase === 'collapse') {
        spinVelRef.current *= 0.985;
        const totalSpin = t * 0.5 + spinVelRef.current * 40;
        const intensity = Math.min(1, spinRef.current / COLLAPSE_THRESHOLD);

        // Vortex center glow
        const glowR = 60 + intensity * 80;
        const glowOpacity = 0.4 + intensity * 0.4;
        const glowGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        glowGrad.addColorStop(0, hsl(270, 80, 60, 0.4));
        glowGrad.addColorStop(0.3, hsl(260, 70, 40, 0.15));
        glowGrad.addColorStop(1, 'transparent');
        ctx!.globalAlpha = glowOpacity;
        ctx!.fillStyle = glowGrad;
        ctx!.beginPath();
        ctx!.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx!.fill();

        // Event horizon
        const ehR = 12 + intensity * 25;
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = '#000000';
        ctx!.beginPath();
        ctx!.arc(cx, cy, ehR, 0, Math.PI * 2);
        ctx!.fill();
        // Purple ring
        ctx!.globalAlpha = 0.3 + intensity * 0.5;
        ctx!.strokeStyle = hsl(270, 90, 70, 0.5);
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ehR + 2, 0, Math.PI * 2);
        ctx!.stroke();

        // Spiral arms
        ctx!.globalAlpha = 0.06 + intensity * 0.29;
        ctx!.strokeStyle = hsl(260, 60, 60, 1);
        ctx!.lineWidth = 2 + intensity * 3;
        for (let arm = 0; arm < 3; arm++) {
          ctx!.beginPath();
          for (let s = 0; s < 80; s++) {
            const a = totalSpin + arm * ((Math.PI * 2) / 3) + s * 0.08;
            const dist = 15 + s * (1.5 + intensity);
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist;
            if (s === 0) ctx!.moveTo(px, py);
            else ctx!.lineTo(px, py);
          }
          ctx!.stroke();
        }

        // Orbital particles
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]!;
          if (internalPhase === 'idle') {
            p.angle += (p.speed + spinVelRef.current) * 0.02;
            const pullD = Math.max(10, p.dist * (1 - intensity * 0.6));
            p.dist += (pullD - p.dist) * 0.05;
          }
          const px = cx + Math.cos(p.angle + totalSpin * 0.3) * p.dist;
          const py = cy + Math.sin(p.angle + totalSpin * 0.3) * p.dist;
          ctx!.globalAlpha = p.alpha * (0.3 + intensity * 0.9);
          ctx!.fillStyle = hsl(p.hue, 70, 60, 1);
          ctx!.beginPath();
          ctx!.arc(px, py, p.radius, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Debris chunks
        const debris = debrisRef.current;
        for (let i = 0; i < debris.length; i++) {
          const d = debris[i]!;
          if (internalPhase === 'idle') {
            d.angle += (d.speed + spinVelRef.current * 0.5) * 0.015;
          }
          const dx = cx + Math.cos(d.angle + totalSpin * 0.2) * d.dist;
          const dy = cy + Math.sin(d.angle + totalSpin * 0.2) * d.dist;
          ctx!.globalAlpha = d.alpha;
          ctx!.fillStyle = hsl(d.hue, 40, 30, 1);
          ctx!.fillRect(dx - d.size / 2, dy - d.size / 2, d.size, d.size);
        }

        // Progress ring
        ctx!.globalAlpha = 1;
        const ringCy = cy + 140;
        const ringR = 30;
        ctx!.strokeStyle = 'rgba(150,100,255,0.2)';
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(cx, ringCy, ringR, 0, Math.PI * 2);
        ctx!.stroke();

        if (intensity > 0) {
          const startA = -Math.PI / 2;
          const endA = startA + intensity * Math.PI * 2;
          ctx!.strokeStyle = hsl(270, 80, 70, 0.6);
          ctx!.lineWidth = 3;
          ctx!.lineCap = 'round';
          ctx!.beginPath();
          ctx!.arc(cx, ringCy, ringR, startA, endA);
          ctx!.stroke();
          ctx!.lineCap = 'butt';

          // Percentage text
          ctx!.font = '12px system-ui, sans-serif';
          ctx!.textAlign = 'center';
          ctx!.textBaseline = 'middle';
          ctx!.fillStyle = 'rgba(255,255,255,0.5)';
          ctx!.fillText(`${Math.round(intensity * 100)}%`, cx, ringCy);
        }
      }

      // ── Burst particles (collapse) ──
      if (internalPhase === 'collapse') {
        const burstElapsed = now - burstStartRef.current;
        const bp = Math.min(1, burstElapsed / BURST_DURATION);

        if (bp < 1) {
          ctx!.filter = 'blur(3px)';
          for (const particle of BURST_PARTICLES) {
            const px = cx + Math.cos(particle.angle) * particle.speed * 25 * bp;
            const linearY = cy + Math.sin(particle.angle) * particle.speed * 25 * bp;
            const py = linearY + bp * bp * 15;
            let alpha: number;
            if (bp < 0.1) alpha = bp / 0.1;
            else alpha = Math.max(0, 1 - (bp - 0.1) / 0.9);
            const r = particle.radius * Math.max(0, 1 - bp * 0.5);

            if (r > 0 && alpha > 0) {
              ctx!.globalAlpha = alpha;
              ctx!.fillStyle = hsl(particle.hue, 80, 60, 1);
              ctx!.beginPath();
              ctx!.arc(px, py, r, 0, Math.PI * 2);
              ctx!.fill();
              // Glow
              ctx!.globalAlpha = alpha * 0.25;
              ctx!.fillStyle = hsl(particle.hue, 80, 60, 0.25);
              ctx!.beginPath();
              ctx!.arc(px, py, r * 2, 0, Math.PI * 2);
              ctx!.fill();
            }
          }
          ctx!.filter = 'none';
        }
      }

      ctx!.globalAlpha = 1;

      if (internalPhase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, cx, cy, internalPhase]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width,
        height,
        display: 'block',
        touchAction: 'none',
        pointerEvents: internalPhase === 'idle' ? 'auto' : 'none',
      }}
    />
  );
}
