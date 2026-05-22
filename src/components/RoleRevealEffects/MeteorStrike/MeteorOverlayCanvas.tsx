'use dom';

/**
 * MeteorOverlayCanvas — Canvas 2D 流星坠落视觉层
 *
 * 星空闪烁 + 流星飞行 + 拖尾 + 陨击冲击波 + 爆炸粒子。
 * 自管理动画循环和命中检测，通过 callback 通知父组件。
 * 不 import service，不含业务逻辑。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const STAR_COUNT = 80;
const TRAIL_LENGTH = 12;
const METEOR_SPEED = 6;
const CATCH_RADIUS = 60;
const IMPACT_PARTICLE_COUNT = 20;
const SHOCKWAVE_COUNT = 2;
const SHOCKWAVE_DURATION = 800;
const EXPLOSION_DURATION = 1000;

const COLORS = {
  meteorCore: '#FFFFFF',
  meteorGlow: 'rgba(255, 240, 200, 0.9)',
  meteorTrail: 'rgba(255, 180, 80, 0.6)',
  meteorTrailFade: 'rgba(255, 100, 30, 0.15)',
  impactOrange: 'rgba(255, 200, 100, 0.9)',
  shockwaveColor: 'rgba(255, 200, 100, 0.7)',
  starColor: 'rgba(200, 210, 255, 0.7)',
} as const;

// ─── Pre-computed data ────────────────────────────────────────────────

const IMPACT_PARTICLES = Array.from({ length: IMPACT_PARTICLE_COUNT }, (_, i) => {
  const angle = (i / IMPACT_PARTICLE_COUNT) * Math.PI * 2 + ((i * 7 + 3) % 10) * 0.06;
  const speed = 2 + ((i * 31) % 100) / 10;
  const r1 = ((i * 43 + 19) % 100) / 100;
  return {
    angle,
    speed,
    radius: 2 + r1 * 5,
    hue: 20 + ((i * 17) % 30),
  };
});

interface StarData {
  x: number;
  y: number;
  radius: number;
  brightness: number;
  speed: number;
  phase: number;
}

function createStars(w: number, h: number): StarData[] {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const r1 = ((i * 73 + 17) % 1000) / 1000;
    const r2 = ((i * 41 + 31) % 1000) / 1000;
    const r3 = ((i * 59 + 7) % 1000) / 1000;
    const r4 = ((i * 83 + 11) % 1000) / 1000;
    const r5 = ((i * 97 + 53) % 1000) / 1000;
    return {
      x: r1 * w,
      y: r2 * h,
      radius: 0.3 + r3 * 1.5,
      brightness: 0.3 + r4 * 0.7,
      speed: 1 + r5 * 3,
      phase: ((i * 67 + 23) % 628) / 100,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────

interface MeteorOverlayCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  phase: 'atmosphere' | 'idle' | 'impact' | 'hidden';
  onMeteorCaught?: () => void;
}

export default function MeteorOverlayCanvas({
  width,
  height,
  phase,
  onMeteorCaught,
}: MeteorOverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<StarData[]>([]);
  const meteorRef = useRef({
    x: -80,
    y: height * 0.18,
    active: false,
    caught: false,
    angle: 0.35,
  });
  const trailRef = useRef<Array<{ x: number; y: number; age: number }>>([]);
  const impactRef = useRef({ x: width / 2, y: height * 0.5, startTime: 0 });
  const [internalPhase, setInternalPhase] = useState(phase);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const caughtRef = useRef(false);

  // Sync external phase
  useEffect(() => {
    setInternalPhase(phase);
    if (phase === 'idle' && !caughtRef.current) {
      spawnMeteor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const spawnMeteor = useCallback(() => {
    const m = meteorRef.current;
    m.x = -60;
    m.y = height * (0.12 + Math.random() * 0.13);
    m.active = true;
    m.caught = false;
    m.angle = 0.25 + Math.random() * 0.2;
    trailRef.current = [];
  }, [height]);

  // Initialize stars once
  useEffect(() => {
    starsRef.current = createStars(width, height);
  }, [width, height]);

  // Handle tap/click on canvas for meteor hit detection
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (internalPhase !== 'idle') return;
      const m = meteorRef.current;
      if (!m.active || m.caught) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const dx = clickX - m.x;
      const dy = clickY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CATCH_RADIUS) {
        m.caught = true;
        m.active = false;
        caughtRef.current = true;
        impactRef.current = { x: m.x, y: m.y, startTime: performance.now() };
        setInternalPhase('impact');
        onMeteorCaught?.();
      }
    },
    [internalPhase, onMeteorCaught],
  );

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    startTimeRef.current = performance.now();
    let lastFrameTime = startTimeRef.current;
    let trailAccum = 0;

    function draw(now: number) {
      const elapsed = now - startTimeRef.current;
      const dt = Math.min((now - lastFrameTime) / 1000, 0.033); // seconds, capped at 33ms
      lastFrameTime = now;
      ctx!.clearRect(0, 0, width, height);

      // ── Stars ──
      const starT = (elapsed / 6000) * Math.PI * 2;
      for (const star of starsRef.current) {
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(starT * star.speed + star.phase));
        const alpha = star.brightness * twinkle;
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = COLORS.starColor;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // ── Meteor (idle phase) ──
      const m = meteorRef.current;
      if (internalPhase === 'idle' && m.active) {
        // Update position (time-based: METEOR_SPEED is px/frame at 60fps → convert to px/s)
        const pxPerSec = METEOR_SPEED * 60;
        m.x += pxPerSec * dt;
        m.y += pxPerSec * Math.tan(m.angle) * dt;

        // Trail (emit every ~50ms regardless of frame rate)
        trailAccum += dt;
        if (trailAccum >= 0.05) {
          trailAccum = 0;
          trailRef.current.push({ x: m.x, y: m.y, age: 0 });
          if (trailRef.current.length > TRAIL_LENGTH) {
            trailRef.current.shift();
          }
        }

        // Draw trail
        for (const pt of trailRef.current) {
          pt.age += dt * 60; // normalize age to 60fps equivalent
          const alpha = Math.max(0, 1 - pt.age / 20);
          ctx!.globalAlpha = alpha * 0.6;
          ctx!.filter = 'blur(3px)';
          ctx!.fillStyle = COLORS.meteorTrail;
          ctx!.beginPath();
          ctx!.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = alpha * 0.3;
          ctx!.filter = 'blur(6px)';
          ctx!.fillStyle = COLORS.meteorTrailFade;
          ctx!.beginPath();
          ctx!.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.filter = 'none';
        ctx!.globalAlpha = 1;

        // Draw meteor head
        // Outer glow
        ctx!.globalAlpha = 0.6;
        ctx!.filter = 'blur(12px)';
        ctx!.fillStyle = COLORS.meteorGlow;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, 35, 0, Math.PI * 2);
        ctx!.fill();
        // Inner glow
        ctx!.filter = 'blur(4px)';
        ctx!.fillStyle = COLORS.meteorGlow;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, 12, 0, Math.PI * 2);
        ctx!.fill();
        // Core
        ctx!.filter = 'none';
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = COLORS.meteorCore;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, 5, 0, Math.PI * 2);
        ctx!.fill();

        // Off screen → respawn
        if (m.x > width + 100) {
          spawnMeteor();
        }
      }

      // ── Impact effects ──
      if (internalPhase === 'impact') {
        const impactElapsed = now - impactRef.current.startTime;
        const ix = impactRef.current.x;
        const iy = impactRef.current.y;

        // Shockwaves
        for (let i = 0; i < SHOCKWAVE_COUNT; i++) {
          const delay = i * 0.12;
          const p = Math.max(0, impactElapsed / SHOCKWAVE_DURATION - delay);
          if (p <= 0 || p > 1) continue;
          const r = p * 200;
          const alpha = Math.max(0, 0.7 - p * 0.8);
          ctx!.globalAlpha = alpha;
          ctx!.strokeStyle = COLORS.shockwaveColor;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.arc(ix, iy, r, 0, Math.PI * 2);
          ctx!.stroke();
        }

        // Particles
        const pp = Math.min(1, impactElapsed / EXPLOSION_DURATION);
        if (pp < 1) {
          ctx!.filter = 'blur(3px)';
          for (const particle of IMPACT_PARTICLES) {
            const endX = ix + Math.cos(particle.angle) * particle.speed * 25;
            const endY = iy + Math.sin(particle.angle) * particle.speed * 25 - 20;
            const px = ix + (endX - ix) * pp;
            const py = iy + (endY - iy) * pp + pp * pp * 40;
            let alpha: number;
            if (pp < 0.1) alpha = pp / 0.1;
            else alpha = Math.max(0, 1 - (pp - 0.1) / 0.9);
            const r = particle.radius * Math.max(0, 1 - pp * 0.6);
            if (r <= 0 || alpha <= 0) continue;

            ctx!.globalAlpha = alpha;
            ctx!.fillStyle = `hsl(${particle.hue}, 90%, 65%)`;
            ctx!.beginPath();
            ctx!.arc(px, py, r, 0, Math.PI * 2);
            ctx!.fill();
            // Glow
            ctx!.globalAlpha = alpha * 0.3;
            ctx!.fillStyle = `hsla(${particle.hue}, 90%, 65%, 0.3)`;
            ctx!.beginPath();
            ctx!.arc(px, py, r * 2, 0, Math.PI * 2);
            ctx!.fill();
          }
          ctx!.filter = 'none';
        }
        ctx!.globalAlpha = 1;
      }

      if (internalPhase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, internalPhase, spawnMeteor]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: internalPhase === 'idle' ? 'auto' : 'none',
      }}
    />
  );
}
