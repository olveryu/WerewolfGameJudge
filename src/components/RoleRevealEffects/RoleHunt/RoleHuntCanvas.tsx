'use dom';

/**
 * RoleHuntCanvas — 森林夜景 + 萤火虫 + 瞄准镜 + 命中爆发（Canvas 2D）
 *
 * 预渲染森林背景（天空渐变 + 星星 + 月亮 + 山丘 + 树线 + 地面 + 草 + 雾 + 暗角），
 * 10 只萤火虫浮动，瞄准镜随手指移动，抬手射击。
 * 完全自管理交互，通过 onShoot 回调通知父组件。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const SCOPE_RADIUS = 45;

const SKY_COLORS = {
  top: '#0b1a2d',
  mid1: '#132844',
  mid2: '#1a3a3a',
  mid3: '#1a4428',
  bottom: '#0d2818',
};

const SCOPE_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.55)',
  lensCenter: 'rgba(200, 230, 255, 0.06)',
  ring: 'rgba(180, 200, 220, 0.6)',
  outerRing: 'rgba(100, 130, 160, 0.3)',
  crosshair: 'rgba(255, 80, 80, 0.7)',
  centerDot: 'rgba(255, 80, 80, 0.8)',
};

const FIREFLY_COLORS = [
  'rgba(180, 220, 255, 0.6)',
  'rgba(150, 200, 255, 0.5)',
  'rgba(200, 230, 255, 0.7)',
  'rgba(100, 180, 255, 0.5)',
  'rgba(180, 255, 220, 0.4)',
];

const BURST_RAY_COLOR = 'rgba(255, 255, 200, 0.8)';
const SHOCKWAVE_COLOR = 'rgba(200, 230, 255, 0.6)';

interface FireflyData {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  driftRadius: number;
  driftPhase: number;
  driftSpeed: number;
  flickerSpeed: number;
  baseOpacity: number;
}

function generateFireflies(w: number, h: number): FireflyData[] {
  return Array.from({ length: 10 }, (_, i) => ({
    cx: (((i * 73 + 17) % 100) / 100) * w,
    cy: h * 0.3 + (((i * 41 + 31) % 100) / 100) * h * 0.5,
    radius: 1 + ((i * 59) % 15) / 10,
    color: FIREFLY_COLORS[i % 5]!,
    driftRadius: 15 + ((i * 83 + 11) % 25),
    driftPhase: (((i * 97 + 53) % 100) / 100) * Math.PI * 2,
    driftSpeed: 0.3 + ((i * 37 + 7) % 30) / 100,
    flickerSpeed: 1.5 + ((i * 43 + 19) % 60) / 100,
    baseOpacity: 0.3 + ((i * 67 + 23) % 50) / 100,
  }));
}

interface BurstRay {
  angle: number;
  length: number;
}

function generateBurstRays(): BurstRay[] {
  return Array.from({ length: 12 }, (_, i) => ({
    angle: (Math.PI * 2 * i) / 12 + (((i * 37 + 5) % 10) / 10 - 0.5) * 0.3,
    length: 60 + ((i * 53 + 7) % 60),
  }));
}

// ─── Forest background rendering (called once) ────────────────────────

function drawForest(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, SKY_COLORS.top);
  skyGrad.addColorStop(0.3, SKY_COLORS.mid1);
  skyGrad.addColorStop(0.55, SKY_COLORS.mid2);
  skyGrad.addColorStop(0.75, SKY_COLORS.mid3);
  skyGrad.addColorStop(1, SKY_COLORS.bottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 60; i++) {
    const sx = (((i * 73 + 17) % 1000) / 1000) * w;
    const sy = (((i * 41 + 31) % 1000) / 1000) * h * 0.45;
    const sr = 0.5 + ((i * 59 + 7) % 20) / 10;
    const alpha = 0.3 + ((i * 83 + 11) % 70) / 100;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgb(200, 220, 255)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon
  const mx = w * 0.8;
  const my = h * 0.12;
  // Moon glow
  ctx.globalAlpha = 1;
  const moonGlowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
  moonGlowGrad.addColorStop(0, 'rgba(200,220,255,0.3)');
  moonGlowGrad.addColorStop(0.5, 'rgba(200,220,255,0.08)');
  moonGlowGrad.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = moonGlowGrad;
  ctx.beginPath();
  ctx.arc(mx, my, 60, 0, Math.PI * 2);
  ctx.fill();
  // Moon body
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgb(230, 240, 255)';
  ctx.beginPath();
  ctx.arc(mx, my, 14, 0, Math.PI * 2);
  ctx.fill();
  // Moon shadow
  ctx.fillStyle = SKY_COLORS.top;
  ctx.beginPath();
  ctx.arc(mx + 6, my - 3, 11, 0, Math.PI * 2);
  ctx.fill();

  // Distant hills
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a2018';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  for (let x = 0; x <= w; x += 20) {
    ctx.lineTo(x, h * 0.55 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.015) * 15);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Tree lines
  drawTreeLine(ctx, w, h, h * 0.5, 0.6, '#071510', 25, 60);
  drawTreeLine(ctx, w, h, h * 0.58, 0.8, '#0a1f15', 18, 80);

  // Ground
  const groundY = h * 0.72;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
  groundGrad.addColorStop(0, '#122a1a');
  groundGrad.addColorStop(0.5, '#0d1f12');
  groundGrad.addColorStop(1, '#080f08');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Grass tufts
  ctx.strokeStyle = 'rgba(40, 80, 50, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const gx = (((i * 73 + 17) % 1000) / 1000) * w;
    const gy = groundY + (((i * 41 + 31) % 100) / 100) * (h - groundY) * 0.3;
    const gh = 8 + ((i * 59 + 7) % 14);
    const dx = (((i * 83 + 11) % 100) / 100 - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + dx, gy - gh, gx + dx * 0.6, gy - gh);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Foreground silhouette trees
  drawSilhouetteTree(ctx, h, -20, h * 0.25, 1);
  drawSilhouetteTree(ctx, h, w - 40, h * 0.2, -1);
  if (w > 350) {
    drawSilhouetteTree(ctx, h, w * 0.15, h * 0.35, 1);
    drawSilhouetteTree(ctx, h, w * 0.78, h * 0.3, -1);
  }

  // Low fog
  for (let i = 0; i < 6; i++) {
    const fx = (((i * 73 + 17) % 100) / 100) * w;
    const fy = groundY - 10 + ((i * 41 + 31) % 40);
    const fr = 80 + ((i * 59 + 7) % 120);
    const fogGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fogGrad.addColorStop(0, 'rgba(100,140,120,0.15)');
    fogGrad.addColorStop(1, 'rgba(100,140,120,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = fogGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette
  const vigR = Math.max(w, h) * 0.7;
  const vigGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, vigR);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, w, h);
}

function drawTreeLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  baseY: number,
  density: number,
  color: string,
  minH: number,
  maxH: number,
) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = -10; x <= w + 10; x += 12 + ((x * 7 + 3) % 8)) {
    const seed = ((x * 73 + 17) % 100) / 100;
    if (seed > density) continue;
    const tH = minH + ((x * 41 + 31) % (maxH - minH));
    const tW = 6 + ((x * 59 + 7) % 10);
    const by = baseY + Math.sin(x * 0.01) * 20;
    ctx.lineTo(x - tW / 2, by);
    ctx.lineTo(x, by - tH);
    ctx.lineTo(x + tW / 2, by);
  }
  ctx.lineTo(w + 10, h);
  ctx.closePath();
  ctx.fill();
}

function drawSilhouetteTree(
  ctx: CanvasRenderingContext2D,
  h: number,
  x: number,
  topY: number,
  dir: number,
) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#040d08';
  ctx.fillRect(x + 20 * dir, topY + 40, 18, h - topY - 40);
  for (let i = 0; i < 3; i++) {
    const ly = topY + i * 35;
    const lw = 50 - i * 8;
    ctx.beginPath();
    ctx.moveTo(x + 28 * dir - lw, ly + 50);
    ctx.lineTo(x + 28 * dir, ly);
    ctx.lineTo(x + 28 * dir + lw, ly + 50);
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Component ────────────────────────────────────────────────────────

interface RoleHuntCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  showScope: boolean;
  hitBurstPos: { x: number; y: number } | null;
  onShoot?: (x: number, y: number) => void;
}

export default function RoleHuntCanvas({
  width,
  height,
  showScope,
  hitBurstPos,
  onShoot,
}: RoleHuntCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const bgRef = useRef<ImageBitmap | null>(null);

  // Scope position
  const scopeRef = useRef({ x: width / 2, y: height / 2 });
  // Fireflies
  const firefliesRef = useRef(generateFireflies(width, height));
  // Burst
  const burstRaysRef = useRef(generateBurstRays());
  const burstStartRef = useRef(0);
  const [burstActive, setBurstActive] = useState(false);

  // Track hitBurstPos changes
  const hitBurstRef = useRef(hitBurstPos);
  useEffect(() => {
    if (hitBurstPos && hitBurstPos !== hitBurstRef.current) {
      hitBurstRef.current = hitBurstPos;
      burstStartRef.current = performance.now();
      setBurstActive(true);
    }
  }, [hitBurstPos]);

  // Pre-render forest background
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    offscreen.width = width * dpr;
    offscreen.height = height * dpr;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    offCtx.scale(dpr, dpr);
    drawForest(offCtx, width, height);
    void createImageBitmap(offscreen).then((bmp) => {
      bgRef.current = bmp;
    });
  }, [width, height]);

  // Pointer events for scope
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    scopeRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    scopeRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onShoot?.(x, y);
    },
    [onShoot],
  );

  // Main draw loop
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

      // ── Forest background (pre-rendered) ──
      if (bgRef.current) {
        ctx!.drawImage(bgRef.current, 0, 0, width, height);
      }

      // ── Fireflies ──
      for (const f of firefliesRef.current) {
        const fx = f.cx + Math.cos(t * f.driftSpeed * Math.PI * 2 + f.driftPhase) * f.driftRadius;
        const fy = f.cy + Math.sin(t * f.driftSpeed * Math.PI * 2 + f.driftPhase) * f.driftRadius;
        const flicker = 0.5 + Math.sin(t * f.flickerSpeed * Math.PI * 2) * 0.5;
        const opacity = f.baseOpacity * (0.2 + flicker * 0.8);
        // Glow
        ctx!.globalAlpha = opacity * 0.5;
        ctx!.filter = 'blur(4px)';
        ctx!.fillStyle = f.color;
        ctx!.beginPath();
        ctx!.arc(fx, fy, f.radius * 2.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
        // Core
        ctx!.globalAlpha = opacity;
        ctx!.beginPath();
        ctx!.arc(fx, fy, f.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Scope overlay ──
      if (showScope) {
        const sx = scopeRef.current.x;
        const sy = scopeRef.current.y;

        // Dark overlay with circular cutout
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = SCOPE_COLORS.overlay;
        ctx!.beginPath();
        ctx!.rect(0, 0, width, height);
        ctx!.arc(sx, sy, SCOPE_RADIUS, 0, Math.PI * 2, true);
        ctx!.fill();

        // Lens brightening
        const lensGrad = ctx!.createRadialGradient(sx, sy, 0, sx, sy, SCOPE_RADIUS);
        lensGrad.addColorStop(0, SCOPE_COLORS.lensCenter);
        lensGrad.addColorStop(1, 'transparent');
        ctx!.fillStyle = lensGrad;
        ctx!.beginPath();
        ctx!.arc(sx, sy, SCOPE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();

        // Scope rings
        ctx!.strokeStyle = SCOPE_COLORS.ring;
        ctx!.lineWidth = 3;
        ctx!.beginPath();
        ctx!.arc(sx, sy, SCOPE_RADIUS, 0, Math.PI * 2);
        ctx!.stroke();

        ctx!.strokeStyle = SCOPE_COLORS.outerRing;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.arc(sx, sy, SCOPE_RADIUS + 6, 0, Math.PI * 2);
        ctx!.stroke();

        // Crosshair lines
        ctx!.strokeStyle = SCOPE_COLORS.crosshair;
        ctx!.lineWidth = 1;
        // Left
        ctx!.beginPath();
        ctx!.moveTo(sx - (SCOPE_RADIUS - 10), sy);
        ctx!.lineTo(sx - 12, sy);
        ctx!.stroke();
        // Right
        ctx!.beginPath();
        ctx!.moveTo(sx + 12, sy);
        ctx!.lineTo(sx + (SCOPE_RADIUS - 10), sy);
        ctx!.stroke();
        // Top
        ctx!.beginPath();
        ctx!.moveTo(sx, sy - (SCOPE_RADIUS - 10));
        ctx!.lineTo(sx, sy - 12);
        ctx!.stroke();
        // Bottom
        ctx!.beginPath();
        ctx!.moveTo(sx, sy + 12);
        ctx!.lineTo(sx, sy + (SCOPE_RADIUS - 10));
        ctx!.stroke();

        // Center dot
        ctx!.fillStyle = SCOPE_COLORS.centerDot;
        ctx!.beginPath();
        ctx!.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Hit burst ──
      if (burstActive && hitBurstRef.current) {
        const elapsed = now - burstStartRef.current;
        const bp = Math.min(1, elapsed / 600);
        const bx = hitBurstRef.current.x;
        const by = hitBurstRef.current.y;

        if (bp < 1) {
          ctx!.filter = 'blur(3px)';
          // Rays
          for (const ray of burstRaysRef.current) {
            const endX = bx + Math.cos(ray.angle) * ray.length * bp;
            const endY = by + Math.sin(ray.angle) * ray.length * bp;
            const rayAlpha = Math.max(0, 1 - bp) * 0.8;
            ctx!.globalAlpha = rayAlpha;
            ctx!.strokeStyle = BURST_RAY_COLOR;
            ctx!.lineWidth = 3;
            ctx!.lineCap = 'round';
            ctx!.beginPath();
            ctx!.moveTo(bx, by);
            ctx!.lineTo(endX, endY);
            ctx!.stroke();
          }
          ctx!.lineCap = 'butt';

          // Shockwave ring
          const shockR = bp * 120;
          const shockAlpha = Math.max(0, 1 - bp) * 0.6;
          ctx!.globalAlpha = shockAlpha;
          ctx!.strokeStyle = SHOCKWAVE_COLOR;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(bx, by, shockR, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.filter = 'none';
        } else {
          setBurstActive(false);
        }
      }

      ctx!.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, showScope, burstActive]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={showScope ? handlePointerDown : undefined}
      onPointerMove={showScope ? handlePointerMove : undefined}
      onPointerUp={showScope ? handlePointerUp : undefined}
      style={{
        width,
        height,
        display: 'block',
        touchAction: 'none',
        pointerEvents: showScope ? 'auto' : 'none',
      }}
    />
  );
}
