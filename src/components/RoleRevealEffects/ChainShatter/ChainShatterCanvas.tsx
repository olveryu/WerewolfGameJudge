'use dom';

/**
 * ChainShatterCanvas — 锁链击碎视觉层（Canvas 2D）
 *
 * 锁头 + 链环 + 裂纹 + 火花 + 冲击环 + 碎片 + 尘埃 + 火把 + 闪电 +
 * 碎裂后碎片 + 径向爆发。
 * 不含交互（Pressable 在父组件），仅接收状态渲染。
 */
import { useEffect, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────

const COLORS = {
  lockBody: '#2A3040',
  lockHighlight: '#4A5570',
  lockStroke: '#5A6580',
  shackle: '#7888A0',
  shackleHighlight: '#A0B0C8',
  keyhole: '#0A0A14',
  keyholeGlow: 'rgba(255, 180, 60, 0.35)',
  chainLinkFill: '#3A4255',
  chainLinkStroke: '#6A7890',
  rivetFill: '#8898B0',
  rivetHighlight: '#B0C0D8',
  sparkPalette: ['#FFD700', '#FFA500', '#FFFFFF', '#FFE066', '#FF8C00'],
  shardPalette: ['#4A5570', '#6A7890', '#8898B0', '#3A4255', '#5A6580', '#FFD080'],
  dustParticle: 'rgba(180, 200, 230, 0.15)',
  shockwaveRing: 'rgba(255, 200, 80, 0.6)',
  radialBurst: 'rgba(255, 220, 100, 0.5)',
  torchFlame: '#FF8C00',
  torchGlow: 'rgba(255, 140, 0, 0.3)',
  lightningArc: 'rgba(150, 200, 255, 0.8)',
  lightningGlow: 'rgba(100, 150, 255, 0.4)',
  debrisColor: 'rgba(100, 90, 80, 0.5)',
};

function crackColor(hitIndex: number, maxHits: number): string {
  const t = Math.min(hitIndex / Math.max(maxHits - 1, 1), 1);
  const r = 255;
  const g = Math.round(200 - t * 120);
  const b = Math.round(50 - t * 20);
  return `rgba(${r}, ${g}, ${b}, 0.9)`;
}

interface CrackData {
  x: number;
  y: number;
  angle: number;
  length: number;
  hitIndex: number;
}

interface SparkBurst {
  id: number;
  sparks: Array<{ vx: number; vy: number; color: string; size: number }>;
  time: number;
}

interface ShardData {
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
}

// Pre-computed dust
function createDust(w: number, h: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    x: (((i * 73 + 17) % 100) / 100) * w,
    y: (((i * 41 + 31) % 100) / 100) * h,
    driftX: 15 + ((i * 59 + 7) % 25),
    driftY: 8 + ((i * 83 + 11) % 15),
    radius: 1.5 + ((i * 37 + 13) % 25) / 10,
  }));
}

// Debris positions
function createDebris(w: number, h: number) {
  return Array.from({ length: 10 }, (_, i) => ({
    x: w * 0.2 + (((i * 73 + 17) % 100) / 100) * w * 0.6,
    y: h * 0.65 + (((i * 41 + 31) % 100) / 100) * h * 0.1,
    size: 2 + ((i * 59 + 7) % 30) / 10,
  }));
}

// Torch positions
function createTorches(w: number, h: number) {
  return [
    { x: 20, y: h * 0.3 },
    { x: w - 50, y: h * 0.35 },
  ];
}

// Chain link paths (ellipses)
function buildChainLinks(cx: number, cy: number, lockW: number, linksPerSide: number) {
  const links: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
  const rx = lockW * 0.11;
  const ry = lockW * 0.065;
  const startOffset = lockW * 0.7;
  const spacing = lockW * 0.22;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < linksPerSide; i++) {
      const lx = cx + side * (startOffset + i * spacing);
      const ly = cy + Math.sin(i * 0.8) * (lockW * 0.05);
      links.push({ cx: lx, cy: ly, rx, ry });
    }
  }
  return links;
}

// Shards for final explosion
function generateShards(count: number, _screenH: number): ShardData[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (((i * 37 + 5) % 10) / 10 - 0.5) * 0.3;
    const speed = 100 + ((i * 53 + 7) % 80);
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      size: 6 + ((i * 41 + 3) % 14),
      color: COLORS.shardPalette[i % COLORS.shardPalette.length]!,
      spin: (((i * 83 + 11) % 100) / 100 - 0.5) * 8,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────

interface ChainShatterCanvasProps {
  dom?: import('expo/dom').DOMProps;
  width: number;
  height: number;
  phase: 'appear' | 'idle' | 'hitting' | 'shatter' | 'hidden';
  hitCount: number;
  requiredHits: number;
  lockWidthRatio: number;
  cracks: CrackData[];
  sparkBursts: SparkBurst[];
  shatterStartTime: number;
  shatterDuration: number;
}

export default function ChainShatterCanvas({
  width,
  height,
  phase,
  hitCount,
  requiredHits,
  lockWidthRatio,
  cracks,
  sparkBursts,
  shatterStartTime,
  shatterDuration,
}: ChainShatterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const cx = width / 2;
  const cy = height / 2;
  const lockW = width * lockWidthRatio;
  const lockH = lockW * 0.8;
  const gravity = height * 0.18;

  // Pre-computed refs
  const dustRef = useRef(createDust(width, height));
  const debrisRef = useRef(createDebris(width, height));
  const torchRef = useRef(createTorches(width, height));
  const chainLinksRef = useRef(buildChainLinks(cx, cy, lockW, 4));
  const shardsRef = useRef(generateShards(18, height));

  useEffect(() => {
    dustRef.current = createDust(width, height);
    debrisRef.current = createDebris(width, height);
    torchRef.current = createTorches(width, height);
    chainLinksRef.current = buildChainLinks(cx, cy, lockW, 4);
    shardsRef.current = generateShards(18, height);
  }, [width, height, cx, cy, lockW]);

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

      // ── Dust particles ──
      for (const dust of dustRef.current) {
        const dx = dust.x + Math.sin(t * 0.5 * Math.PI * 2) * dust.driftX;
        const dy = dust.y + Math.cos(t * 0.5 * Math.PI * 2) * dust.driftY;
        const op = 0.08 + Math.sin(t * 0.5 * Math.PI * 2) * 0.07;
        ctx!.globalAlpha = op;
        ctx!.fillStyle = COLORS.dustParticle;
        ctx!.beginPath();
        ctx!.arc(dx, dy, dust.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Torch flames ──
      for (const torch of torchRef.current) {
        const flicker = (Math.sin(t * 8) + 1) / 2;
        const tx = torch.x + 15;
        const ty = torch.y;
        const swayX = tx + Math.sin(t * 6) * 3;
        const tipY = ty - 8 + Math.sin(t * 12) * 2;

        // Glow
        ctx!.globalAlpha = 0.15 + flicker * 0.15;
        ctx!.filter = 'blur(20px)';
        ctx!.fillStyle = COLORS.torchGlow;
        ctx!.beginPath();
        ctx!.arc(tx, ty + 5, 35, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';

        // Outer flame
        ctx!.globalAlpha = 0.7 + flicker * 0.3;
        ctx!.filter = 'blur(6px)';
        ctx!.fillStyle = 'rgba(255, 80, 20, 0.7)';
        ctx!.beginPath();
        ctx!.arc(swayX, ty + 8, 14, 0, Math.PI * 2);
        ctx!.fill();
        // Mid flame
        ctx!.filter = 'blur(4px)';
        ctx!.fillStyle = 'rgba(255, 160, 40, 0.85)';
        ctx!.beginPath();
        ctx!.arc(swayX, ty, 10, 0, Math.PI * 2);
        ctx!.fill();
        // Inner flame
        ctx!.filter = 'blur(2px)';
        ctx!.fillStyle = 'rgba(255, 230, 80, 0.9)';
        ctx!.beginPath();
        ctx!.arc(swayX, tipY, 6, 0, Math.PI * 2);
        ctx!.fill();
        // White tip
        ctx!.filter = 'blur(1px)';
        ctx!.fillStyle = 'rgba(255, 255, 220, 0.95)';
        ctx!.beginPath();
        ctx!.arc(swayX, tipY, 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.filter = 'none';
      }

      // ── Lock + Chains (only in idle/hitting) ──
      if (phase === 'idle' || phase === 'hitting' || phase === 'appear') {
        ctx!.globalAlpha = 1;

        // Chain links
        for (const link of chainLinksRef.current) {
          ctx!.fillStyle = COLORS.chainLinkFill;
          ctx!.beginPath();
          ctx!.ellipse(link.cx, link.cy, link.rx, link.ry, 0, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.strokeStyle = COLORS.chainLinkStroke;
          ctx!.lineWidth = 3;
          ctx!.stroke();
        }

        // Lock body
        const lx = cx - lockW / 2;
        const ly = cy - lockH / 2;
        ctx!.fillStyle = COLORS.lockBody;
        ctx!.fillRect(lx, ly, lockW, lockH);
        // Highlight band
        ctx!.globalAlpha = 0.5;
        ctx!.fillStyle = COLORS.lockHighlight;
        ctx!.fillRect(lx, ly, lockW, lockH * 0.15);
        ctx!.globalAlpha = 1;
        // Stroke
        ctx!.strokeStyle = COLORS.lockStroke;
        ctx!.lineWidth = 2.5;
        ctx!.strokeRect(lx, ly, lockW, lockH);

        // Shackle (arc above)
        ctx!.strokeStyle = COLORS.shackle;
        ctx!.lineWidth = lockW * 0.1;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.arc(cx, cy - lockH / 2, lockW * 0.25, Math.PI, 0);
        ctx!.stroke();
        // Shackle highlight
        ctx!.globalAlpha = 0.4;
        ctx!.strokeStyle = COLORS.shackleHighlight;
        ctx!.lineWidth = lockW * 0.03;
        ctx!.beginPath();
        ctx!.arc(cx, cy - lockH / 2, lockW * 0.25, Math.PI, 0);
        ctx!.stroke();
        ctx!.globalAlpha = 1;
        ctx!.lineCap = 'butt';

        // Keyhole glow
        ctx!.fillStyle = COLORS.keyholeGlow;
        ctx!.beginPath();
        ctx!.arc(cx, cy, lockW * 0.16, 0, Math.PI * 2);
        ctx!.fill();
        // Keyhole
        ctx!.fillStyle = COLORS.keyhole;
        ctx!.beginPath();
        ctx!.arc(cx, cy, lockW * 0.1, 0, Math.PI * 2);
        ctx!.fill();
        // Keyhole slot
        ctx!.fillRect(cx - lockW * 0.02, cy, lockW * 0.04, lockW * 0.12);

        // Rivets
        const rivetR = lockW * 0.035;
        const rivets = [
          { x: lx + lockW * 0.15, y: ly + lockH * 0.2 },
          { x: lx + lockW * 0.85, y: ly + lockH * 0.2 },
          { x: lx + lockW * 0.15, y: ly + lockH * 0.8 },
          { x: lx + lockW * 0.85, y: ly + lockH * 0.8 },
        ];
        for (const rivet of rivets) {
          ctx!.fillStyle = COLORS.rivetFill;
          ctx!.beginPath();
          ctx!.arc(rivet.x, rivet.y, rivetR, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.strokeStyle = COLORS.rivetHighlight;
          ctx!.lineWidth = 1;
          ctx!.globalAlpha = 0.5;
          ctx!.stroke();
          ctx!.globalAlpha = 0.6;
          ctx!.fillStyle = COLORS.rivetHighlight;
          ctx!.beginPath();
          ctx!.arc(rivet.x - lockW * 0.01, rivet.y - lockW * 0.01, lockW * 0.012, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.globalAlpha = 1;
        }

        // ── Cracks ──
        for (const crack of cracks) {
          const ex = crack.x + Math.cos(crack.angle) * crack.length;
          const ey = crack.y + Math.sin(crack.angle) * crack.length;
          const color = crackColor(crack.hitIndex, requiredHits);
          // Glow
          ctx!.globalAlpha = 0.4;
          ctx!.strokeStyle = color;
          ctx!.lineWidth = 6;
          ctx!.lineCap = 'round';
          ctx!.beginPath();
          ctx!.moveTo(crack.x, crack.y);
          ctx!.lineTo(ex, ey);
          ctx!.stroke();
          // Core
          ctx!.globalAlpha = 0.9;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(crack.x, crack.y);
          ctx!.lineTo(ex, ey);
          ctx!.stroke();
          ctx!.lineCap = 'butt';
          ctx!.globalAlpha = 1;
        }

        // ── Spark bursts ──
        for (const burst of sparkBursts) {
          const elapsed = (now - burst.time) / 1000;
          const p = Math.min(1, elapsed / 0.4);
          if (p >= 1) continue;
          for (const spark of burst.sparks) {
            const sx = cx + spark.vx * p;
            const sy = cy + spark.vy * p + 60 * p * p;
            const op = Math.max(0, 1 - p * 1.5);
            const r = spark.size * Math.max(0, 1 - p);
            if (op > 0 && r > 0) {
              ctx!.globalAlpha = op;
              ctx!.fillStyle = spark.color;
              ctx!.beginPath();
              ctx!.arc(sx, sy, r, 0, Math.PI * 2);
              ctx!.fill();
            }
          }
        }

        // ── Shockwave (last hit time) ──
        if (sparkBursts.length > 0) {
          const lastBurst = sparkBursts[sparkBursts.length - 1]!;
          const elapsed = (now - lastBurst.time) / 1000;
          const p = Math.min(1, elapsed / 0.35);
          if (p < 1) {
            const maxR = lockW * 0.8;
            const r = p * maxR;
            const op = Math.max(0, 0.6 - p * 0.8);
            ctx!.globalAlpha = op;
            ctx!.strokeStyle = COLORS.shockwaveRing;
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.arc(cx, cy, r, 0, Math.PI * 2);
            ctx!.stroke();
          }
        }

        // ── Lightning (above 3 hits) ──
        if (hitCount >= 3) {
          // Brief flash on recent hit
          const lastBurstTime =
            sparkBursts.length > 0 ? sparkBursts[sparkBursts.length - 1]!.time : 0;
          const sinceLast = now - lastBurstTime;
          if (sinceLast < 250) {
            const lOp = Math.max(0, 1 - sinceLast / 250);
            ctx!.globalAlpha = lOp * 0.8;
            ctx!.strokeStyle = COLORS.lightningArc;
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.moveTo(cx - lockW * 0.25, cy - lockH * 0.2);
            ctx!.lineTo(cx + lockW * 0.15, cy + lockH * 0.15);
            ctx!.stroke();
            ctx!.beginPath();
            ctx!.moveTo(cx + lockW * 0.2, cy - lockH * 0.15);
            ctx!.lineTo(cx - lockW * 0.1, cy + lockH * 0.2);
            ctx!.stroke();
            // Glow
            ctx!.filter = 'blur(4px)';
            ctx!.globalAlpha = lOp * 0.4;
            ctx!.strokeStyle = COLORS.lightningGlow;
            ctx!.lineWidth = 6;
            ctx!.beginPath();
            ctx!.moveTo(cx - lockW * 0.25, cy - lockH * 0.2);
            ctx!.lineTo(cx + lockW * 0.15, cy + lockH * 0.15);
            ctx!.stroke();
            ctx!.filter = 'none';
          }
        }

        // ── Ground debris (after first hit) ──
        if (hitCount > 0) {
          ctx!.globalAlpha = Math.min(1, hitCount / 3);
          ctx!.fillStyle = COLORS.debrisColor;
          for (const d of debrisRef.current) {
            ctx!.beginPath();
            ctx!.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // ── Shatter phase: shards + radial burst ──
      if (phase === 'shatter' && shatterStartTime > 0) {
        const elapsed = (now - shatterStartTime) / 1000;
        const sp = Math.min(1, (elapsed * 1000) / shatterDuration);

        // Radial burst lines
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const maxR = width * 0.5;
          const innerR = sp * maxR * 0.2;
          const outerR = sp * maxR;
          const op = Math.max(0, 0.5 - sp * 0.7);
          if (op > 0) {
            ctx!.globalAlpha = op;
            ctx!.strokeStyle = COLORS.radialBurst;
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
            ctx!.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
            ctx!.stroke();
          }
        }

        // Shard pieces
        for (const shard of shardsRef.current) {
          const sx = cx + shard.vx * sp;
          const sy = cy + shard.vy * sp + gravity * sp * sp;
          const rot = shard.spin * sp;
          const op = Math.max(0, 1 - sp * 1.2);
          if (op > 0) {
            ctx!.globalAlpha = op;
            ctx!.save();
            ctx!.translate(sx, sy);
            ctx!.rotate(rot);
            // Irregular polygon
            const halfW = shard.size / 2;
            const halfH = (shard.size * 0.6) / 2;
            ctx!.fillStyle = shard.color;
            ctx!.beginPath();
            ctx!.moveTo(-halfW * 0.8, -halfH);
            ctx!.lineTo(halfW * 0.6, -halfH * 0.7);
            ctx!.lineTo(halfW, halfH * 0.3);
            ctx!.lineTo(halfW * 0.4, halfH);
            ctx!.lineTo(-halfW, halfH * 0.6);
            ctx!.closePath();
            ctx!.fill();
            // Edge highlight
            ctx!.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
            ctx!.restore();
          }
        }
      }

      ctx!.globalAlpha = 1;

      if (phase !== 'hidden') {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    width,
    height,
    cx,
    cy,
    lockW,
    lockH,
    gravity,
    phase,
    cracks,
    sparkBursts,
    hitCount,
    requiredHits,
    shatterStartTime,
    shatterDuration,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    />
  );
}
