/**
 * Canvas 2D draw functions for all 60 root-level (epic/legendary) seat flairs.
 *
 * Each exported FlairDrawConfig contains:
 * - durations: timer durations in ms
 * - draw: renders one frame given (ctx, size, progress[])
 */
import type { FlairDrawConfig } from './types';
import {
  drawLegendaryAura,
  drawLine,
  fillCircle,
  fillPath,
  strokeCircle,
  strokePath,
} from './utils';

// ═══════════════════════════════════════════════════════════════════════════════
// A–B
// ═══════════════════════════════════════════════════════════════════════════════

/** AmberDrop — 琥珀坠落: teardrop paths with glint highlights */
export const drawAmberDrop: FlairDrawConfig = {
  durations: [4500],
  draw(ctx, size, [p0]) {
    const COUNT = 5;
    for (let i = 0; i < COUNT; i++) {
      const xAnchor = 0.15 + (i * 0.7) / (COUNT - 1);
      const swingAmp = 0.03 + (i % 3) * 0.015;
      const phase = i / COUNT;
      const rFrac = 0.018 + (i % 2) * 0.008;
      const t = (p0 + phase) % 1;
      const y = t * size;
      const swing = Math.sin(t * Math.PI * 3) * swingAmp * size;
      const cx = xAnchor * size + swing;
      const r = rFrac * size;
      // Teardrop path
      const d = `M ${cx} ${y - r * 2} Q ${cx - r} ${y - r} ${cx - r} ${y} A ${r} ${r} 0 1 0 ${cx + r} ${y} Q ${cx + r} ${y - r} ${cx} ${y - r * 2} Z`;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(200,150,40)';
      fillPath(ctx, d);
      ctx.strokeStyle = 'rgb(220,170,60)';
      ctx.lineWidth = size * 0.003;
      strokePath(ctx, d);
      // Glint
      const glintAlpha = t > 0.1 && t < 0.8 ? 0.6 : 0;
      ctx.globalAlpha = glintAlpha;
      ctx.fillStyle = 'rgb(255,230,150)';
      fillCircle(ctx, cx - r * 0.3, y - r * 0.3, r * 0.25);
    }
  },
};

/** ArcticWind — 极地寒风: horizontal wind streaks with ice particles */
export const drawArcticWind: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0]) {
    const COUNT = 6;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const yFrac = 0.15 + (i * 0.7) / (COUNT - 1);
      const phase = i / COUNT;
      const length = 0.15 + (i % 3) * 0.06;
      const t = (p0 + phase) % 1;
      const xStart = size * (1.1 - t * 1.3);
      const xEnd = xStart - length * size;
      const y = yFrac * size + Math.sin(t * Math.PI * 3) * size * 0.02;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
      // Line
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(180,220,255)';
      ctx.lineWidth = size * 0.008;
      drawLine(ctx, xStart, y, xEnd, y);
      // Ice particle
      const iceX = size * (1.1 - t * 1.3) - length * size * 0.5;
      const iceY = y - size * 0.015;
      const iceAlpha = t < 0.15 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 0.45;
      ctx.globalAlpha = iceAlpha;
      ctx.fillStyle = 'rgb(220,240,255)';
      fillCircle(ctx, iceX, iceY, size * 0.006);
    }
    ctx.lineCap = 'butt';
  },
};

/** AshCloud — 灰烬之云: drifting ash particles with halos */
export const drawAshCloud: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const COUNT = 10;
    for (let i = 0; i < COUNT; i++) {
      const cx0 = 0.1 + (i % 5) * 0.2;
      const cy0 = 0.1 + Math.floor(i / 5) * 0.4;
      const driftX = ((i % 3) - 1) * 0.06;
      const driftY = -0.05 + (i % 2) * 0.03;
      const phase = i / COUNT;
      const rFrac = 0.006 + (i % 3) * 0.003;
      const t = (p0 + phase) % 1;
      const wobbleX = Math.sin(t * Math.PI * 3 + driftX * 10) * size * 0.03;
      const wobbleY = Math.cos(t * Math.PI * 2.5 + driftY * 8) * size * 0.025;
      const cx = cx0 * size + driftX * size * t + wobbleX;
      const cy = cy0 * size + driftY * size * t + wobbleY;
      const flicker = 0.15 + Math.sin(t * Math.PI * 5 + phase * 12) * 0.1;
      // Halo
      ctx.globalAlpha = 0.08 + Math.sin(t * Math.PI * 5 + phase * 12) * 0.05;
      ctx.fillStyle = 'rgb(130,120,110)';
      fillCircle(ctx, cx, cy, rFrac * size * 2.5);
      // Core
      ctx.globalAlpha = flicker;
      ctx.fillStyle = 'rgb(90,80,70)';
      fillCircle(ctx, cx, cy, rFrac * size);
    }
  },
};

/** AuraBurst — 灵气爆发: expanding concentric rings */
export const drawAuraBurst: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COLORS = [
      [160, 120, 255],
      [120, 180, 255],
      [180, 100, 255],
    ];
    const half = size / 2;
    for (let i = 0; i < 3; i++) {
      const phase = i / 3;
      const [cr, cg, cb] = COLORS[i]!;
      const t = (p0 + phase) % 1;
      const r = t * size * 0.55;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) / 0.9;
      // Outer ring
      ctx.globalAlpha = alpha * 0.2;
      ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
      ctx.lineWidth = size * 0.015;
      strokeCircle(ctx, half, half, r);
      // Inner ring
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = size * 0.006;
      strokeCircle(ctx, half, half, r * 0.9);
    }
  },
};

/** BlazeTrail — 烈焰轨迹: rotating arcs with gradient layers */
export const drawBlazeTrail: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0]) {
    const COUNT = 3;
    const half = size / 2;
    const orbit = size * 0.42;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const phase = i / COUNT;
      const span = Math.PI * 0.5 + (i % 2) * Math.PI * 0.2;
      const t = (p0 + phase) % 1;
      const startA = t * Math.PI * 2;
      const endA = startA + span;
      // Build arc paths
      const buildArc = (sa: number, ea: number) => {
        const x1 = half + Math.cos(sa) * orbit;
        const y1 = half + Math.sin(sa) * orbit;
        const x2 = half + Math.cos(ea) * orbit;
        const y2 = half + Math.sin(ea) * orbit;
        return `M ${x1} ${y1} A ${orbit} ${orbit} 0 0 1 ${x2} ${y2}`;
      };
      // Outer glow
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = 'rgb(255,80,0)';
      ctx.lineWidth = size * 0.03;
      strokePath(ctx, buildArc(startA, endA));
      // Mid
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = 'rgb(255,160,40)';
      ctx.lineWidth = size * 0.015;
      strokePath(ctx, buildArc(startA + span * 0.15, startA + span * 0.85));
      // Core
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = 'rgb(255,240,180)';
      ctx.lineWidth = size * 0.006;
      strokePath(ctx, buildArc(startA + span * 0.3, startA + span * 0.7));
      // Head dot
      const headAngle = endA;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgb(255,240,180)';
      fillCircle(
        ctx,
        half + Math.cos(headAngle) * orbit,
        half + Math.sin(headAngle) * orbit,
        size * 0.012,
      );
    }
    ctx.lineCap = 'butt';
  },
};

/** BloodMark — 血月印记: dripping blood drops with trails */
export const drawBloodMark: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0]) {
    const N = 4;
    const TRAIL_LEN = 3;
    for (let i = 0; i < N; i++) {
      const xFrac = 0.2 + (i * 0.6) / (N - 1);
      const phase = i / N;
      const rFrac = 0.018 + (i % 2) * 0.006;
      const t = (p0 + phase) % 1;
      const x = xFrac * size;
      const y = t * size;
      const r = rFrac * size;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
      // Trails (drawn first, behind main)
      ctx.fillStyle = 'rgb(140,10,10)';
      for (let j = TRAIL_LEN; j >= 1; j--) {
        ctx.globalAlpha = alpha * (1 - j / (TRAIL_LEN + 1)) * 0.6;
        fillCircle(ctx, x, y - j * r * 1.5, r * (1 - j * 0.15));
      }
      // Main drop
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(180,20,20)';
      fillCircle(ctx, x, y, r);
    }
  },
};

/** Butterfly — 蝶影翩翩: butterflies with flapping wings */
export const drawButterfly: FlairDrawConfig = {
  durations: [6000, 7000],
  draw(ctx, size, [p0, p1]) {
    drawLegendaryAura(ctx, size, p1!, 180, 100, 220, 0.32);
    const COLORS = [
      [180, 100, 220],
      [200, 120, 240],
      [160, 80, 200],
      [220, 140, 255],
      [190, 90, 230],
      [210, 130, 250],
    ];
    const half = size / 2;
    for (let i = 0; i < 6; i++) {
      const phase = i / 6;
      const orbit = 0.28 + (i % 2) * 0.08;
      const speed = 0.6 + i * 0.1;
      const [cr, cg, cb] = COLORS[i]!;
      const angle = (p0 * speed + phase) * Math.PI * 2;
      const dist = orbit * size + Math.sin(p0 * Math.PI * 4) * size * 0.03;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const wingFlap = Math.abs(Math.sin(p0 * Math.PI * 8 + phase * 10));
      const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
      const alpha = 0.4 + 0.4 * wingFlap;
      const bodyAngle = angle + Math.PI / 2;
      const wdx = Math.cos(bodyAngle) * wingR * 0.5;
      const wdy = Math.sin(bodyAngle) * wingR * 0.5;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      // Wings
      ctx.globalAlpha = alpha;
      fillCircle(ctx, x - wdx, y - wdy, wingR);
      fillCircle(ctx, x + wdx, y + wdy, wingR);
      // Body
      ctx.globalAlpha = alpha + 0.2;
      fillCircle(ctx, x, y, size * 0.005);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// C–D
// ═══════════════════════════════════════════════════════════════════════════════

/** CometTail — 彗星拖尾: orbiting comets with particle trails */
export const drawCometTail: FlairDrawConfig = {
  durations: [5000, 7000],
  draw(ctx, size, [p0, p1]) {
    drawLegendaryAura(ctx, size, p1!, 160, 190, 255, 0.4);
    const half = size / 2;
    const orbit = size * 0.4;
    const TRAIL = 8;
    for (let i = 0; i < 3; i++) {
      const angle0 = (i / 3) * Math.PI * 2;
      const phase = i / 3;
      const speed = 0.5 + i * 0.15;
      const angle = angle0 + p0 * speed * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin((p0 * 4 + phase * 6) * Math.PI);
      // Trail dots
      ctx.fillStyle = 'rgb(180,200,255)';
      for (let j = TRAIL; j >= 0; j--) {
        const ta = angle - j * 0.12;
        const td = orbit + j * 1;
        const tx = half + Math.cos(ta) * td;
        const ty = half + Math.sin(ta) * td;
        const r = j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
        const a = j === 0 ? pulse * 0.85 : Math.max(0, pulse * (0.5 - j * 0.05));
        ctx.globalAlpha = a;
        fillCircle(ctx, tx, ty, r);
      }
      // Head glow
      const headX = half + Math.cos(angle) * orbit;
      const headY = half + Math.sin(angle) * orbit;
      ctx.globalAlpha = pulse * 0.3;
      ctx.fillStyle = 'rgb(220,235,255)';
      fillCircle(ctx, headX, headY, size * 0.03);
    }
  },
};

/** CoralGlow — 珊瑚荧光: growing coral branches with glowing tips */
export const drawCoralGlow: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COUNT = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const xBase = 0.2 + (i * 0.6) / (COUNT - 1);
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const pulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
      const bx = xBase * size;
      const by = size * 0.95;
      const ty = by - size * 0.35;
      // Trunk
      ctx.globalAlpha = pulse * 0.4;
      ctx.strokeStyle = 'rgb(255,100,80)';
      ctx.lineWidth = size * 0.012;
      drawLine(ctx, bx, by, bx, ty);
      // Branches
      const forkY1 = by - size * 0.2;
      ctx.globalAlpha = pulse * 0.35;
      ctx.lineWidth = size * 0.008;
      strokePath(
        ctx,
        `M ${bx} ${forkY1} Q ${bx - size * 0.03} ${forkY1 - size * 0.06} ${bx - size * 0.06} ${forkY1 - size * 0.12}`,
      );
      const forkY2 = by - size * 0.15;
      strokePath(
        ctx,
        `M ${bx} ${forkY2} Q ${bx + size * 0.03} ${forkY2 - size * 0.05} ${bx + size * 0.05} ${forkY2 - size * 0.1}`,
      );
      // Tip glow
      const tipPulse = Math.max(0, Math.sin(t * Math.PI * 3) * 0.6);
      ctx.globalAlpha = tipPulse;
      ctx.fillStyle = 'rgb(255,180,120)';
      fillCircle(ctx, bx, ty, size * 0.015);
    }
    ctx.lineCap = 'butt';
  },
};

/** CrystalShard — 水晶碎片: orbiting diamond shapes */
export const drawCrystalShard: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const COUNT = 6;
    const half = size / 2;
    for (let i = 0; i < COUNT; i++) {
      const orbitR = 0.42 + (i % 3) * 0.04;
      const angleOff = (i / COUNT) * Math.PI * 2;
      const phase = i / COUNT;
      const shardH = 0.04 + (i % 2) * 0.015;
      const shardW = 0.02 + (i % 3) * 0.005;
      const t = (p0 + phase) % 1;
      const angle = t * Math.PI * 2 + angleOff;
      const px = half + Math.cos(angle) * orbitR * size;
      const py = half + Math.sin(angle) * orbitR * size;
      const hw = shardW * size;
      const hh = shardH * size;
      const alpha = 0.3 + Math.sin(t * Math.PI * 4) * 0.15;
      // Diamond shape
      const d = `M ${px} ${py - hh} L ${px + hw} ${py} L ${px} ${py + hh} L ${px - hw} ${py} Z`;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${100 + ((i * 20) % 80)},${200 + ((i * 10) % 55)},255)`;
      ctx.lineWidth = size * 0.008;
      strokePath(ctx, d);
      // Center sparkle
      ctx.globalAlpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.5);
      ctx.fillStyle = 'rgb(200,240,255)';
      fillCircle(ctx, px, py, size * 0.008);
      // Center line to hub
      ctx.globalAlpha = alpha * 0.1;
      ctx.strokeStyle = 'rgb(150,220,255)';
      ctx.lineWidth = 0.5;
      drawLine(ctx, half, half, px, py);
    }
  },
};

/** DarkSmoke — 暗烟升腾: rising smoke wisps */
export const drawDarkSmoke: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const xBase = 0.2 + (i * 0.6) / (COUNT - 1);
      const phase = i / COUNT;
      const drift = 0.05 + (i % 3) * 0.02;
      const width = 0.03 + (i % 2) * 0.015;
      const t = (p0 + phase) % 1;
      const base = size * xBase;
      const y0 = size * (1 - t * 0.8);
      const y1 = y0 - size * 0.15;
      const y2 = y1 - size * 0.15;
      const y3 = y2 - size * 0.15;
      const dx = drift * size * Math.sin(t * Math.PI * 3);
      const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
      // Smoke path
      const d = `M ${base} ${y0} Q ${base + dx} ${y1} ${base - dx * 0.5} ${y2} Q ${base + dx * 0.3} ${y3 + size * 0.05} ${base} ${y3}`;
      ctx.globalAlpha = alpha * 0.25;
      ctx.strokeStyle = 'rgb(80,60,100)';
      ctx.lineWidth = width * size;
      strokePath(ctx, d);
      // Head particle
      const headY = y0 - size * 0.45;
      const headDx = drift * size * Math.sin(t * Math.PI * 3) * 0.3;
      const headAlpha = t < 0.2 ? 0 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
      ctx.globalAlpha = headAlpha;
      ctx.fillStyle = 'rgb(60,40,80)';
      fillCircle(ctx, base + headDx, headY, width * size * 0.8);
    }
    ctx.lineCap = 'butt';
  },
};

/** DawnLight — 曙光微照: rising light beams from bottom */
export const drawDawnLight: FlairDrawConfig = {
  durations: [4500],
  draw(ctx, size, [p0]) {
    const COUNT = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const xFrac = 0.15 + (i * 0.7) / (COUNT - 1);
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const cx = xFrac * size;
      const length = size * 0.25 * (0.5 + t * 0.5);
      const alpha = Math.sin(t * Math.PI) * 0.4;
      // Light beam
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(255,220,130)';
      ctx.lineWidth = size * 0.015;
      drawLine(ctx, cx, size, cx + size * 0.02 * Math.sin(t * Math.PI * 2), size - length);
      // Glow dot at tip
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = 'rgb(255,240,180)';
      fillCircle(ctx, cx, size - length, size * 0.012);
    }
    ctx.lineCap = 'butt';
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// E–F
// ═══════════════════════════════════════════════════════════════════════════════

/** EclipseRing — 日蚀光环: dark center with corona arcs */
export const drawEclipseRing: FlairDrawConfig = {
  durations: [8000],
  draw(ctx, size, [p0]) {
    const half = size / 2;
    const orbit = size * 0.42;
    // Dark center
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = 'rgb(20,10,40)';
    fillCircle(ctx, half, half, size * 0.2);
    // Corona arcs
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const phase = i / 4;
      const t = (p0 + phase) % 1;
      const startAngle = t * Math.PI * 2;
      const span = Math.PI * 0.4;
      const pulse = 0.3 + 0.7 * Math.sin(t * Math.PI * 2);
      const sx = half + Math.cos(startAngle) * orbit;
      const sy = half + Math.sin(startAngle) * orbit;
      const ex = half + Math.cos(startAngle + span) * orbit;
      const ey = half + Math.sin(startAngle + span) * orbit;
      const d = `M ${sx} ${sy} A ${orbit} ${orbit} 0 0 1 ${ex} ${ey}`;
      ctx.globalAlpha = pulse * 0.4;
      ctx.strokeStyle = 'rgb(255,200,80)';
      ctx.lineWidth = size * 0.02;
      strokePath(ctx, d);
      // Thinner inner arc
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = 'rgb(255,240,180)';
      ctx.lineWidth = size * 0.008;
      strokePath(ctx, d);
    }
    ctx.lineCap = 'butt';
  },
};

/** EmberGlow — 余烬微光: rising ember particles */
export const drawEmberGlow: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COUNT = 6;
    const COLORS = [
      [255, 140, 0],
      [255, 180, 50],
      [255, 100, 20],
      [255, 160, 30],
      [255, 200, 80],
      [255, 120, 10],
    ];
    for (let i = 0; i < COUNT; i++) {
      const xFrac = 0.15 + (i * 0.7) / (COUNT - 1);
      const phase = i / COUNT;
      const rFrac = 0.02 + (i % 3) * 0.008;
      const [cr, cg, cb] = COLORS[i]!;
      const t = (p0 + phase) % 1;
      const y = size * (1 - t);
      const x = xFrac * size + Math.sin(t * Math.PI * 2) * size * 0.04;
      const r = rFrac * size;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      fillCircle(ctx, x, y, r);
    }
  },
};

/** Firefly — 萤火虫之夜 (root): glowing fireflies wandering */
export const drawFireflyRoot: FlairDrawConfig = {
  durations: [7000],
  draw(ctx, size, [p0]) {
    const COUNT = 6;
    const SEEDS = [0.13, 0.47, 0.73, 0.29, 0.61, 0.89];
    const half = size / 2;
    const range = size * 0.35;
    for (let i = 0; i < COUNT; i++) {
      const seed = SEEDS[i]!;
      const freqX = 1.0 + seed * 2;
      const freqY = 0.8 + seed * 1.5;
      const freqBlink = 2 + seed * 3;
      const t = p0 * Math.PI * 2;
      const cx = half + Math.sin(t * freqX + seed * 10) * range;
      const cy = half + Math.cos(t * freqY + seed * 7) * range;
      const blink = Math.sin(t * freqBlink + seed * 5);
      if (blink <= 0) continue;
      const alpha = blink * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(180,255,80)';
      fillCircle(ctx, cx, cy, size * 0.01);
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = 'rgb(220,255,150)';
      fillCircle(ctx, cx, cy, size * 0.025);
    }
  },
};

/** FireRing — 烈焰之环: orbital fire particles with trails */
export const drawFireRing: FlairDrawConfig = {
  durations: [3000, 7000],
  draw(ctx, size, [p0, p1]) {
    drawLegendaryAura(ctx, size, p1!, 240, 80, 0, 0.42);
    const N = 8;
    const TRAIL = 3;
    const COLORS = [
      [220, 40, 0],
      [240, 120, 0],
      [255, 180, 30],
      [220, 60, 0],
      [240, 100, 10],
      [255, 160, 20],
      [200, 30, 0],
      [240, 140, 0],
    ];
    const half = size / 2;
    const orbit = size * 0.42;
    for (let i = 0; i < N; i++) {
      const [cr, cg, cb] = COLORS[i]!;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      for (let t = TRAIL; t >= 0; t--) {
        const baseAngle = (i / N) * Math.PI * 2 + p0 * Math.PI * 2;
        const trailAngle = baseAngle - t * 0.08;
        const x = half + Math.cos(trailAngle) * orbit;
        const y = half + Math.sin(trailAngle) * orbit;
        const alphaScale = t === 0 ? 1 : (1 - t / (TRAIL + 1)) * 0.5;
        const rScale = t === 0 ? 1 : 1 - t * 0.2;
        ctx.globalAlpha = alphaScale * 0.75;
        fillCircle(ctx, x, y, size * 0.02 * rScale);
      }
    }
  },
};

/** FlowerBloom — 繁花盛开: blooming flower petals */
export const drawFlowerBloom: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 5;
    const half = size / 2;
    for (let i = 0; i < COUNT; i++) {
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const angle = (i / COUNT) * Math.PI * 2;
      const dist = size * 0.3 * (0.5 + t * 0.5);
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const petalR = size * 0.03 * (0.4 + 0.6 * Math.sin(t * Math.PI));
      const alpha = Math.sin(t * Math.PI) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(255,150,180)';
      fillCircle(ctx, x, y, petalR);
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = 'rgb(255,200,210)';
      fillCircle(ctx, x, y, petalR * 1.5);
    }
    // Center
    ctx.globalAlpha = 0.4 + Math.sin(p0 * Math.PI * 2) * 0.2;
    ctx.fillStyle = 'rgb(255,220,100)';
    fillCircle(ctx, half, half, size * 0.02);
  },
};

/** ForestLeaf — 落叶知秋: falling leaves swaying */
export const drawForestLeaf: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 6;
    const COLORS = [
      'rgb(180,120,40)',
      'rgb(200,160,50)',
      'rgb(160,100,30)',
      'rgb(140,180,60)',
      'rgb(190,140,40)',
      'rgb(170,110,35)',
    ];
    for (let i = 0; i < COUNT; i++) {
      const xFrac = 0.1 + (i * 0.8) / (COUNT - 1);
      const phase = i / COUNT;
      const sway = 0.04 + (i % 3) * 0.02;
      const t = (p0 + phase) % 1;
      const y = t * size;
      const x = xFrac * size + Math.sin(t * Math.PI * 3) * size * sway;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 0.6;
      const rotation = t * Math.PI * 2;
      const rx = size * 0.012;
      const ry = size * 0.008;
      // Leaf as an ellipse approximation
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[i]!;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry * Math.abs(Math.cos(rotation)), rotation, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/** FrostAura — 寒霜气场: orbiting frost particles */
export const drawFrostAura: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    ctx.fillStyle = 'rgb(140,220,255)';
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const orbitFrac = 0.42 + (i % 3) * 0.05;
      const rFrac = 0.015 + (i % 4) * 0.005;
      const speed = 0.8 + (i % 3) * 0.2;
      const angle = angle0 + p0 * Math.PI * 2 * speed;
      const orbit = orbitFrac * size;
      const x = half + Math.cos(angle) * orbit;
      const y = half + Math.sin(angle) * orbit;
      const pulse = 0.5 + 0.5 * Math.sin(p0 * Math.PI * 4 + i);
      const alpha = 0.3 + pulse * 0.4;
      const r = rFrac * size * (0.8 + pulse * 0.4);
      ctx.globalAlpha = alpha;
      fillCircle(ctx, x, y, r);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// G–L
// ═══════════════════════════════════════════════════════════════════════════════

/** GhostWisp — 幽灵鬼火: wandering ghost wisps with tails */
export const drawGhostWisp: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 5;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const orbitR = 0.3 + (i % 3) * 0.06;
      const t = p0;
      const angle = angle0 + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + phase * 10) * 0.3;
      const dist = orbitR * size + Math.sin(t * Math.PI * 3 + phase * 8) * size * 0.04;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + phase * 6) * Math.PI));
      // Outer glow
      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = 'rgb(100,200,255)';
      fillCircle(ctx, x, y, size * 0.04);
      // Core
      ctx.globalAlpha = pulse * 0.9;
      ctx.fillStyle = 'rgb(180,230,255)';
      fillCircle(ctx, x, y, size * 0.018);
      // Tails
      ctx.fillStyle = 'rgb(100,200,255)';
      for (let j = 1; j <= 3; j++) {
        const ta = angle - j * 0.15;
        const td = dist - j * 2;
        ctx.globalAlpha = Math.max(0, pulse * (0.3 - j * 0.1));
        fillCircle(
          ctx,
          half + Math.cos(ta) * td,
          half + Math.sin(ta) * td,
          size * (0.012 - j * 0.002),
        );
      }
    }
  },
};

/** GoldSpark — 金星四溅: bursting gold cross sparkles */
export const drawGoldSpark: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2 + i * 0.7;
      const dist0 = 0.35 + (i % 4) * 0.04;
      const phase = i / N;
      const burst = 0.3 + (i % 3) * 0.1;
      const t = p0;
      const tt = (t * 1.5 + phase) % 1;
      const burstDist = dist0 * size + tt * size * burst;
      const angle = angle0 + Math.sin(t * Math.PI * 2) * 0.2;
      const x = half + Math.cos(angle) * burstDist;
      const y = half + Math.sin(angle) * burstDist;
      const tooClose = burstDist < size * 0.25;
      const alpha = tt < 0.1 ? tt / 0.1 : (1 - tt) * 0.8;
      if (tooClose) continue;
      const armLen = size * 0.02 * (1 - tt * 0.5);
      // Cross arms
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = 'rgb(255,210,60)';
      ctx.lineWidth = 1.2;
      drawLine(ctx, x - armLen, y, x + armLen, y);
      drawLine(ctx, x, y - armLen, x, y + armLen);
      // Center dot
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = 'rgb(255,240,150)';
      fillCircle(ctx, x, y, size * 0.01);
    }
  },
};

/** GoldenShine — 金色闪耀: radial sparkle flashes */
export const drawGoldenShine: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0]) {
    const N = 10;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + i * 0.3;
      const dist0 = 0.32 + (i % 4) * 0.06;
      const phase = i / N;
      const rFrac = 0.012 + (i % 3) * 0.006;
      const t = (p0 + phase) % 1;
      const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
      if (flash < 0.01) continue;
      const d = dist0 * size * (0.9 + flash * 0.2);
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const r = rFrac * size * (0.5 + flash);
      // Glow
      ctx.globalAlpha = flash * 0.3;
      ctx.fillStyle = 'rgb(255,220,100)';
      fillCircle(ctx, x, y, r * 2);
      // Core
      ctx.globalAlpha = flash * 0.9;
      ctx.fillStyle = 'rgb(255,200,50)';
      fillCircle(ctx, x, y, r);
    }
  },
};

/** IceCrystal — 冰晶棱镜: rotating hexagonal crystals */
export const drawIceCrystal: FlairDrawConfig = {
  durations: [8000],
  draw(ctx, size, [p0]) {
    const N = 6;
    const half = size / 2;
    const dist = size * 0.32;
    for (let i = 0; i < N; i++) {
      const t = p0;
      const angle = (i / N) * Math.PI * 2 + t * Math.PI * 0.5;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + i * 0.5) * Math.PI));
      // Hexagon
      const hexR = size * 0.04;
      let d = '';
      for (let h = 0; h < 6; h++) {
        const ha = (h / 6) * Math.PI * 2 - Math.PI / 2 + t * Math.PI;
        const vx = x + Math.cos(ha) * hexR;
        const vy = y + Math.sin(ha) * hexR;
        d += h === 0 ? `M ${vx} ${vy}` : ` L ${vx} ${vy}`;
      }
      d += ' Z';
      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeStyle = 'rgb(150,220,255)';
      ctx.lineWidth = 1.2;
      strokePath(ctx, d);
      // Center dot
      ctx.globalAlpha = pulse * 0.8;
      ctx.fillStyle = 'rgb(200,240,255)';
      fillCircle(ctx, x, y, size * 0.01);
      // Line to center
      ctx.globalAlpha = pulse * 0.1;
      ctx.strokeStyle = 'rgb(150,220,255)';
      ctx.lineWidth = 0.5;
      drawLine(ctx, half, half, x, y);
    }
  },
};

/** JadeMist — 玉雾弥漫: jade-colored drifting mist */
export const drawJadeMist: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 6;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const dist = 0.3 + (i % 3) * 0.06;
      const phase = i / N;
      const maxR = 0.05 + (i % 3) * 0.02;
      const t = p0;
      const angle = angle0 + Math.sin((t + phase) * Math.PI * 2) * 0.4;
      const d = dist * size + Math.sin(t * Math.PI * 2 + phase * 5) * size * 0.03;
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + phase * 4) * Math.PI));
      const r = maxR * size * (0.6 + 0.4 * pulse);
      // Outer
      ctx.globalAlpha = pulse * 0.08;
      ctx.fillStyle = 'rgb(40,140,80)';
      fillCircle(ctx, x, y, r);
      // Inner
      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = 'rgb(80,180,120)';
      fillCircle(ctx, x, y, r * 0.5);
    }
  },
};

/** LavaBurst — 熔岩迸发: bursting lava particles */
export const drawLavaBurst: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    const COLORS = [
      [220, 40, 0],
      [240, 100, 0],
      [255, 160, 20],
      [200, 30, 0],
      [240, 80, 0],
      [255, 140, 10],
      [220, 60, 0],
      [240, 120, 10],
    ];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const phase = i / N;
      const [cr, cg, cb] = COLORS[i]!;
      const t = (p0 + phase) % 1;
      const dist = t * size * 0.45;
      const x = half + Math.cos(angle + Math.sin(t * Math.PI * 2) * 0.3) * dist;
      const y = half + Math.sin(angle + Math.sin(t * Math.PI * 2) * 0.3) * dist;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.8;
      const r = size * 0.015 * (1 - t * 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      fillCircle(ctx, x, y, r);
    }
  },
};

/** LightPillar — 四柱天光: vertical light pillars */
export const drawLightPillar: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const POSITIONS = [0.15, 0.38, 0.62, 0.85];
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const xFrac = POSITIONS[i]!;
      const phase = i / 4;
      const t = (p0 + phase) % 1;
      const pulse = Math.sin(t * Math.PI) * 0.6;
      const x = xFrac * size;
      // Beam
      ctx.globalAlpha = pulse * 0.3;
      ctx.strokeStyle = 'rgb(255,250,200)';
      ctx.lineWidth = size * 0.02;
      drawLine(ctx, x, 0, x, size);
      // Bright center section
      const centerY = size * (0.3 + t * 0.4);
      ctx.globalAlpha = pulse * 0.5;
      ctx.lineWidth = size * 0.01;
      drawLine(ctx, x, centerY - size * 0.1, x, centerY + size * 0.1);
    }
    ctx.lineCap = 'butt';
  },
};

/** LunarFrost — 月霜凝结: frost crystallization with lunar glow */
export const drawLunarFrost: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const dist = 0.35 + (i % 3) * 0.05;
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const angle = angle0 + t * Math.PI * 0.3;
      const x = half + Math.cos(angle) * dist * size;
      const y = half + Math.sin(angle) * dist * size;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + phase * 4) * Math.PI));
      // Ice crystal arms (3 lines)
      ctx.strokeStyle = 'rgb(180,220,255)';
      ctx.lineWidth = 0.8;
      for (let a = 0; a < 3; a++) {
        const armAngle = (a / 3) * Math.PI + t * Math.PI;
        const armLen = size * 0.015;
        ctx.globalAlpha = pulse * 0.6;
        drawLine(
          ctx,
          x - Math.cos(armAngle) * armLen,
          y - Math.sin(armAngle) * armLen,
          x + Math.cos(armAngle) * armLen,
          y + Math.sin(armAngle) * armLen,
        );
      }
      // Center
      ctx.globalAlpha = pulse * 0.8;
      ctx.fillStyle = 'rgb(200,240,255)';
      fillCircle(ctx, x, y, size * 0.005);
    }
  },
};

/** LunarHalo — 月华光环: sweeping arcs around center */
export const drawLunarHalo: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const ARC_COUNT = 3;
    const ARC_SPAN = Math.PI * 0.6;
    const half = size / 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < ARC_COUNT; i++) {
      const t = p0;
      const orbit = size * 0.42 - i * size * 0.02;
      const angle = t * Math.PI * 2 + i * ((Math.PI * 2) / 3);
      const pulse = 0.4 + 0.6 * Math.sin((t * 4 + i) * Math.PI);
      const sx = half + Math.cos(angle) * orbit;
      const sy = half + Math.sin(angle) * orbit;
      const ex = half + Math.cos(angle + ARC_SPAN) * orbit;
      const ey = half + Math.sin(angle + ARC_SPAN) * orbit;
      const d = `M ${sx} ${sy} A ${orbit} ${orbit} 0 0 1 ${ex} ${ey}`;
      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = 'rgb(180,200,255)';
      ctx.lineWidth = 3 - i * 0.5;
      strokePath(ctx, d);
      // Tip glow
      ctx.globalAlpha = pulse * 0.7;
      ctx.fillStyle = 'rgb(200,220,255)';
      fillCircle(ctx, ex, ey, size * 0.02);
    }
    ctx.lineCap = 'butt';
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// M–O
// ═══════════════════════════════════════════════════════════════════════════════

/** MagmaFloat — 熔岩浮石: floating magma rocks */
export const drawMagmaFloat: FlairDrawConfig = {
  durations: [5000, 7000],
  draw(ctx, size, [p0, p1]) {
    drawLegendaryAura(ctx, size, p1!, 200, 60, 20, 0.38);
    const N = 6;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2 + i * 0.4;
      const dist0 = 0.35 + (i % 3) * 0.06;
      const phase = i / N;
      const rFrac = 0.018 + (i % 3) * 0.007;
      const t = p0;
      const tt = (t + phase) % 1;
      const angle = angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
      const dist = dist0 * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + phase * 5) * Math.PI));
      const r = rFrac * size;
      // Glow
      ctx.globalAlpha = pulse * 0.12;
      ctx.fillStyle = 'rgb(255,80,0)';
      fillCircle(ctx, x, y + r * 0.5, r * 1.3);
      // Body
      ctx.globalAlpha = pulse * 0.6;
      ctx.fillStyle = 'rgb(200,60,20)';
      fillCircle(ctx, x, y, r);
      // Lobe
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = 'rgb(240,120,20)';
      fillCircle(ctx, x + r * 0.4, y - r * 0.3, r * 0.7);
    }
  },
};

/** MirageHeat — 海市蜃楼: heat shimmer waves */
export const drawMirageHeat: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COUNT = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const yFrac = 0.2 + (i * 0.6) / (COUNT - 1);
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const y = yFrac * size;
      const amp = size * 0.03 * Math.sin(t * Math.PI * 2);
      const d = `M 0 ${y + amp} Q ${size * 0.25} ${y - amp} ${size * 0.5} ${y + amp} Q ${size * 0.75} ${y - amp} ${size} ${y + amp}`;
      const alpha = 0.15 + Math.sin(t * Math.PI) * 0.1;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(255,200,100)';
      ctx.lineWidth = 1.5;
      strokePath(ctx, d);
    }
    ctx.lineCap = 'butt';
  },
};

/** MistVeil — 迷雾面纱: swirling mist patches */
export const drawMistVeil: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 6;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const dist = 0.32 + (i % 3) * 0.05;
      const phase = i / N;
      const t = p0;
      const angle = angle0 + Math.sin((t + phase) * Math.PI * 2) * 0.5;
      const d = dist * size + Math.sin(t * Math.PI * 2 + phase * 6) * size * 0.04;
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const pulse = 0.2 + 0.4 * Math.abs(Math.sin((t * 1.5 + phase * 3) * Math.PI));
      const r = size * 0.04 * (0.5 + 0.5 * pulse);
      ctx.globalAlpha = pulse * 0.12;
      ctx.fillStyle = 'rgb(200,200,220)';
      fillCircle(ctx, x, y, r);
      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = 'rgb(220,220,240)';
      fillCircle(ctx, x, y, r * 0.5);
    }
  },
};

/** MoonBeam — 月光束: descending moonlight rays */
export const drawMoonBeam: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const xFrac = 0.2 + (i * 0.6) / (COUNT - 1);
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const x = xFrac * size;
      const topY = 0;
      const botY = size * (0.4 + t * 0.6);
      const alpha = Math.sin(t * Math.PI) * 0.25;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(200,210,255)';
      ctx.lineWidth = size * 0.025;
      drawLine(ctx, x, topY, x + size * 0.03 * Math.sin(t * Math.PI * 2), botY);
      // Bottom glow
      ctx.globalAlpha = alpha * 1.5;
      ctx.fillStyle = 'rgb(220,230,255)';
      fillCircle(ctx, x, botY, size * 0.015);
    }
    ctx.lineCap = 'butt';
  },
};

/** NightGlow — 夜光虫: bioluminescent particles */
export const drawNightGlow: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    const range = size * 0.38;
    for (let i = 0; i < N; i++) {
      const seed = (i * 0.13 + 0.07) % 1;
      const freqX = 0.8 + seed * 1.5;
      const freqY = 0.6 + seed * 1.2;
      const t = p0 * Math.PI * 2;
      const x = half + Math.sin(t * freqX + i * 2.1) * range;
      const y = half + Math.cos(t * freqY + i * 1.7) * range;
      const blink = Math.sin(t * (1.5 + seed * 2) + i * 3.3);
      if (blink <= 0) continue;
      ctx.globalAlpha = blink * 0.5;
      ctx.fillStyle = 'rgb(100,255,150)';
      fillCircle(ctx, x, y, size * 0.008);
      ctx.globalAlpha = blink * 0.15;
      ctx.fillStyle = 'rgb(150,255,180)';
      fillCircle(ctx, x, y, size * 0.02);
    }
  },
};

/** ObsidianPulse — 黑曜脉动: dark pulsing circles */
export const drawObsidianPulse: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const N = 3;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const r = size * 0.1 + t * size * 0.35;
      const alpha = (1 - t) * 0.25;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(80,40,120)';
      ctx.lineWidth = size * 0.015 * (1 - t);
      strokeCircle(ctx, half, half, r);
    }
    // Center core
    const corePulse = 0.3 + 0.4 * Math.sin(p0 * Math.PI * 4);
    ctx.globalAlpha = corePulse;
    ctx.fillStyle = 'rgb(60,20,100)';
    fillCircle(ctx, half, half, size * 0.03);
  },
};

/** OceanWave — 海浪涌动: rolling wave curves */
export const drawOceanWave: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COUNT = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const yBase = size * (0.35 + i * 0.15);
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const amp = size * 0.04 * (1 + Math.sin(t * Math.PI));
      const xOff = t * size * 0.3;
      const d = `M ${-size * 0.1 + xOff} ${yBase} Q ${size * 0.25 + xOff} ${yBase - amp} ${size * 0.5 + xOff} ${yBase} Q ${size * 0.75 + xOff} ${yBase + amp} ${size * 1.1 + xOff} ${yBase}`;
      const alpha = 0.2 + Math.sin(t * Math.PI) * 0.15;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${60 + i * 20},${140 + i * 20},${220 + i * 10})`;
      ctx.lineWidth = 2 - i * 0.4;
      strokePath(ctx, d);
    }
    ctx.lineCap = 'butt';
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// P–R
// ═══════════════════════════════════════════════════════════════════════════════

/** PetalDance — 花瓣飞舞: swirling petals */
export const drawPetalDance: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const dist = 0.25 + (i % 3) * 0.08;
      const t = (p0 + phase) % 1;
      const angle = angle0 + t * Math.PI * 2;
      const d = dist * size * (0.8 + 0.4 * Math.sin(t * Math.PI * 2));
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const alpha = 0.3 + 0.4 * Math.sin(t * Math.PI);
      const r = size * 0.015;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? 'rgb(255,180,200)' : 'rgb(255,150,180)';
      // Petal as ellipse
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/** PhoenixFeather — 凤凰羽: spiraling feather strokes */
export const drawPhoenixFeather: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const dist0 = 0.25 + (i % 3) * 0.08;
      const t = p0;
      const tt = (t + phase) % 1;
      const spiralAngle = angle0 + tt * Math.PI * 4;
      const dist = (dist0 + tt * 0.2) * size;
      const y0 = half - tt * size * 0.3;
      const x0 = half + Math.cos(spiralAngle) * dist * 0.3;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;
      const featherLen = size * 0.035;
      const ang = spiralAngle + Math.PI / 2;
      const dx = Math.cos(ang) * featherLen;
      const dy = Math.sin(ang) * featherLen;
      // Feather line
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = 'rgb(255,160,30)';
      ctx.lineWidth = 2;
      drawLine(ctx, x0 - dx, y0 - dy, x0 + dx, y0 + dy);
      // Glow
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = 'rgb(255,100,20)';
      fillCircle(ctx, x0, y0, size * 0.025);
    }
    ctx.lineCap = 'butt';
  },
};

/** PoisonBubble — 剧毒气泡: rising toxic bubbles */
export const drawPoisonBubble: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 8;
    for (let i = 0; i < N; i++) {
      const xFrac = 0.15 + (i * 0.7) / (N - 1);
      const phase = i / N;
      const rFrac = 0.02 + (i % 3) * 0.008;
      const speed = 0.6 + (i % 4) * 0.1;
      const tt = (p0 * speed + phase) % 1;
      const y = size * (1 - tt * 0.9) - size * 0.05;
      const x = xFrac * size + Math.sin(tt * Math.PI * 2) * size * 0.03;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.6;
      const r = rFrac * size * (1 + tt * 0.3);
      // Bubble outline
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = 'rgb(80,220,80)';
      ctx.lineWidth = 1;
      strokeCircle(ctx, x, y, r);
      // Highlight
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = 'rgb(150,255,150)';
      fillCircle(ctx, x - r * 0.3, y - r * 0.3, r * 0.25);
    }
  },
};

/** PrismShard — 棱镜碎片: rotating prism triangles */
export const drawPrismShard: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 5;
    const half = size / 2;
    const COLORS = [
      'rgb(255,100,100)',
      'rgb(100,255,100)',
      'rgb(100,100,255)',
      'rgb(255,255,100)',
      'rgb(255,100,255)',
    ];
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const dist = 0.35 + (i % 3) * 0.04;
      const t = (p0 + phase) % 1;
      const angle = angle0 + t * Math.PI * 2;
      const x = half + Math.cos(angle) * dist * size;
      const y = half + Math.sin(angle) * dist * size;
      const pulse = 0.3 + 0.5 * Math.sin(t * Math.PI * 2);
      const triR = size * 0.02;
      // Triangle
      let d = '';
      for (let v = 0; v < 3; v++) {
        const va = (v / 3) * Math.PI * 2 + t * Math.PI * 3;
        const vx = x + Math.cos(va) * triR;
        const vy = y + Math.sin(va) * triR;
        d += v === 0 ? `M ${vx} ${vy}` : ` L ${vx} ${vy}`;
      }
      d += ' Z';
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = COLORS[i]!;
      ctx.lineWidth = 1.2;
      strokePath(ctx, d);
    }
  },
};

/** PurpleMist — 紫雾缭绕: layered purple mist clouds */
export const drawPurpleMist: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 7;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const dist0 = 0.35 + (i % 3) * 0.05;
      const phase = i / N;
      const driftSpeed = 0.3 + (i % 4) * 0.15;
      const maxRFrac = 0.04 + (i % 3) * 0.02;
      const t = p0;
      const angle = angle0 + Math.sin((t * driftSpeed + phase) * Math.PI * 2) * 0.6;
      const dist = dist0 * size + Math.sin(t * Math.PI * 2 + phase * 5) * size * 0.04;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + phase * 4) * Math.PI));
      const r = maxRFrac * size * (0.6 + 0.4 * pulse);
      // Outer
      ctx.globalAlpha = pulse * 0.08;
      ctx.fillStyle = 'rgb(80,30,160)';
      fillCircle(ctx, x, y, r);
      // Mid
      ctx.globalAlpha = pulse * 0.15;
      ctx.fillStyle = 'rgb(100,50,180)';
      fillCircle(ctx, x, y, r * 0.6);
      // Inner
      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = 'rgb(140,80,200)';
      fillCircle(ctx, x, y, r * 0.3);
    }
  },
};

/** RainDrop — 细雨绵绵: falling rain drops */
export const drawRainDrop: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0]) {
    const N = 10;
    ctx.strokeStyle = 'rgb(140,180,220)';
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const xFrac = 0.05 + (i * 0.9) / (N - 1);
      const phase = i / N;
      const speed = 0.8 + (i % 3) * 0.2;
      const t = (p0 * speed + phase) % 1;
      const x = xFrac * size;
      const y = t * size;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 0.4;
      const dropLen = size * 0.03;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1;
      drawLine(ctx, x, y, x, y - dropLen);
    }
    ctx.lineCap = 'butt';
  },
};

/** RuneCircle — 符文之环: orbiting rune glyphs */
export const drawRuneCircle: FlairDrawConfig = {
  durations: [10000, 7000],
  draw(ctx, size, [p0, p1]) {
    drawLegendaryAura(ctx, size, p1!, 180, 120, 240, 0.42);
    const N = 8;
    const half = size / 2;
    const orbit = 0.42 * size;
    const GLYPHS = [
      'cross',
      'diamond',
      'triangle',
      'square',
      'cross',
      'diamond',
      'triangle',
      'square',
    ];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + p0 * Math.PI * 2;
      const x = half + Math.cos(angle) * orbit;
      const y = half + Math.sin(angle) * orbit;
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(((p0 * N - i) * Math.PI * 2) / N));
      // Halo
      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = 'rgb(180,120,240)';
      fillCircle(ctx, x, y, size * 0.04 * 1.6);
      // Glyph
      const glyphR = size * 0.04;
      const glyph = GLYPHS[i]!;
      let d = '';
      if (glyph === 'cross') {
        d = `M ${x - glyphR} ${y} L ${x + glyphR} ${y} M ${x} ${y - glyphR} L ${x} ${y + glyphR}`;
      } else if (glyph === 'diamond') {
        d = `M ${x} ${y - glyphR} L ${x + glyphR * 0.7} ${y} L ${x} ${y + glyphR} L ${x - glyphR * 0.7} ${y} Z`;
      } else if (glyph === 'triangle') {
        d = `M ${x} ${y - glyphR} L ${x + glyphR * 0.87} ${y + glyphR * 0.5} L ${x - glyphR * 0.87} ${y + glyphR * 0.5} Z`;
      } else {
        d = `M ${x - glyphR * 0.7} ${y - glyphR * 0.7} L ${x + glyphR * 0.7} ${y - glyphR * 0.7} L ${x + glyphR * 0.7} ${y + glyphR * 0.7} L ${x - glyphR * 0.7} ${y + glyphR * 0.7} Z`;
      }
      ctx.globalAlpha = pulse * 0.85;
      ctx.strokeStyle = 'rgb(200,160,255)';
      ctx.lineWidth = 1.5;
      strokePath(ctx, d);
      // Center dot
      ctx.globalAlpha = pulse * 0.7;
      ctx.fillStyle = 'rgb(220,190,255)';
      fillCircle(ctx, x, y, size * 0.006);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// S
// ═══════════════════════════════════════════════════════════════════════════════

/** Sakura — 樱花飘落: falling sakura petals (multi-dot cluster) */
export const drawSakura: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 6;
    for (let i = 0; i < N; i++) {
      const xFrac = 0.1 + (i * 0.8) / (N - 1);
      const phase = i / N;
      const swayAmp = 0.04 + (i % 3) * 0.02;
      const swayFreq = 1.5 + (i % 2) * 0.5;
      const t = (p0 + phase) % 1;
      const y = t * size;
      const x = xFrac * size + Math.sin(t * Math.PI * 2 * swayFreq) * size * swayAmp;
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
      const r = size * 0.015;
      const a = t * Math.PI;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      // Petal cluster (5 dots)
      ctx.fillStyle = 'rgb(255,183,197)';
      ctx.globalAlpha = alpha;
      fillCircle(ctx, x, y, r * 0.7); // center
      fillCircle(ctx, x + dx, y + dy, r * 0.6); // fwd
      fillCircle(ctx, x - dx, y - dy, r * 0.6); // bwd
      ctx.fillStyle = 'rgb(255,210,220)';
      ctx.globalAlpha = alpha * 0.6;
      fillCircle(ctx, x + dy, y - dx, r * 0.5); // side A
      fillCircle(ctx, x - dy, y + dx, r * 0.5); // side B
    }
  },
};

/** SandStormFlair — 沙暴席卷: swirling sand particles */
export const drawSandStormFlair: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0]) {
    const N = 12;
    const half = size / 2;
    ctx.fillStyle = 'rgb(200,170,100)';
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const dist = 0.25 + (i % 4) * 0.06;
      const t = (p0 + phase) % 1;
      const angle = angle0 + t * Math.PI * 3;
      const d = dist * size * (0.5 + t * 0.8);
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.6;
      ctx.globalAlpha = alpha;
      fillCircle(ctx, x, y, size * 0.006);
    }
  },
};

/** ShadowClaw — 暗影之爪: dark claw slashes */
export const drawShadowClaw: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0]) {
    const N = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const intensity = t < 0.2 ? t / 0.2 : t < 0.5 ? 1 - (t - 0.2) / 0.3 : 0;
      if (intensity < 0.01) continue;
      const startX = size * (0.3 + i * 0.12);
      const startY = size * 0.2;
      const endX = startX + size * 0.15;
      const endY = size * 0.8;
      const midX = (startX + endX) / 2 + size * 0.05 * Math.sin(i);
      const midY = (startY + endY) / 2;
      const d = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
      ctx.globalAlpha = intensity * 0.6;
      ctx.strokeStyle = 'rgb(40,10,60)';
      ctx.lineWidth = size * 0.02;
      strokePath(ctx, d);
      ctx.globalAlpha = intensity * 0.8;
      ctx.strokeStyle = 'rgb(80,20,100)';
      ctx.lineWidth = size * 0.008;
      strokePath(ctx, d);
    }
    ctx.lineCap = 'butt';
  },
};

/** ShadowMist — 暗影迷雾: rising dark mist particles */
export const drawShadowMist: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 5;
    ctx.fillStyle = 'rgb(42,16,64)';
    for (let i = 0; i < N; i++) {
      const xFrac = 0.15 + (i * 0.7) / (N - 1);
      const phase = i / N;
      const maxR = 0.06 + (i % 3) * 0.02;
      const t = (p0 + phase) % 1;
      const y = size * (1 - t * 0.6);
      const x = xFrac * size + Math.sin(t * Math.PI * 3) * size * 0.03;
      const r = maxR * size * (0.3 + t * 0.7);
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.4;
      ctx.globalAlpha = alpha;
      fillCircle(ctx, x, y, r);
    }
  },
};

/** SilverStream — 银流蜿蜒: flowing silver paths */
export const drawSilverStream: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const yBase = size * (0.2 + i * 0.25);
      const amp = size * 0.05 * Math.sin(t * Math.PI * 2);
      const xOff = t * size * 0.4;
      const d = `M ${-size * 0.1 + xOff} ${yBase} Q ${size * 0.3 + xOff} ${yBase + amp} ${size * 0.5 + xOff} ${yBase} Q ${size * 0.7 + xOff} ${yBase - amp} ${size * 1.1 + xOff} ${yBase}`;
      const alpha = 0.2 + Math.sin(t * Math.PI) * 0.15;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(200,210,230)';
      ctx.lineWidth = 1.5;
      strokePath(ctx, d);
    }
    ctx.lineCap = 'butt';
  },
};

/** Snowfall — 纷飞白雪: falling snowflakes with rotating arms */
export const drawSnowfall: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const xFrac = 0.05 + (i * 0.9) / (N - 1);
      const phase = i / N;
      const rFrac = 0.008 + (i % 3) * 0.005;
      const speed = 0.4 + (i % 4) * 0.1;
      const sway = 0.02 + (i % 3) * 0.015;
      const tt = (p0 * speed + phase) % 1;
      const y = tt * size;
      const x = xFrac * size + Math.sin(tt * Math.PI * 4) * size * sway;
      const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
      const r = rFrac * size;
      // 3 rotating arms
      ctx.strokeStyle = 'rgb(220,230,255)';
      ctx.lineWidth = 0.8;
      for (let a = 0; a < 3; a++) {
        const ang = (a / 3) * Math.PI + tt * Math.PI;
        ctx.globalAlpha = alpha * 0.8;
        drawLine(
          ctx,
          x - Math.cos(ang) * r,
          y - Math.sin(ang) * r,
          x + Math.cos(ang) * r,
          y + Math.sin(ang) * r,
        );
      }
      // Center dot
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = 'rgb(240,245,255)';
      fillCircle(ctx, x, y, size * 0.005);
    }
  },
};

/** SolarFlare — 日冕耀斑: erupting solar flares */
export const drawSolarFlare: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const N = 5;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const intensity = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
      const dist = size * 0.35 * (0.3 + t * 0.7);
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      // Flare body
      ctx.globalAlpha = intensity * 0.5;
      ctx.fillStyle = 'rgb(255,180,50)';
      fillCircle(ctx, x, y, size * 0.025 * (1 - t * 0.5));
      // Outer glow
      ctx.globalAlpha = intensity * 0.2;
      ctx.fillStyle = 'rgb(255,100,20)';
      fillCircle(ctx, x, y, size * 0.04 * (1 - t * 0.3));
    }
  },
};

/** SonicWave — 音波震荡: expanding wobbly wave rings */
export const drawSonicWave: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const WAVE_COUNT = 5;
    const half = size / 2;
    const SEGS = 48;
    for (let i = 0; i < WAVE_COUNT; i++) {
      const wt = (p0 * 1.2 + i / WAVE_COUNT) % 1;
      const radius = size * 0.12 + wt * size * 0.36;
      const alpha = (1 - wt) * 0.55;
      const sw = 1.5 * (1 - wt * 0.5);
      let d = '';
      for (let s = 0; s <= SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        const w = 1 + 0.06 * Math.sin(a * 8 + p0 * Math.PI * 12 + i * 2);
        const x = half + Math.cos(a) * radius * w;
        const y = half + Math.sin(a) * radius * w;
        d += s === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      d += ' Z';
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(80,200,180)';
      ctx.lineWidth = sw;
      strokePath(ctx, d);
    }
  },
};

/** StarDust — 星尘飘散: drifting star dust particles */
export const drawStarDust: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 10;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const seed = ((i * 7 + 3) % 10) / 10;
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const angle = seed * Math.PI * 2 + t * Math.PI;
      const dist = (0.2 + seed * 0.3) * size;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const blink = Math.sin(t * Math.PI * 2 + seed * 10);
      const alpha = blink > 0 ? blink * 0.6 : 0;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(255,250,200)';
      fillCircle(ctx, x, y, size * 0.006);
      ctx.globalAlpha = alpha * 0.3;
      fillCircle(ctx, x, y, size * 0.015);
    }
  },
};

/** Starlight — 星光点缀: drifting four-pointed stars */
export const drawStarlight: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const N = 6;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const dist0 = 0.35 + (i % 3) * 0.05;
      const phase = i / N;
      const drift = 0.4 + (i % 4) * 0.25;
      const angle = angle0 + p0 * Math.PI * 2 * drift;
      const d = dist0 * size;
      const x = half + Math.cos(angle) * d;
      const y = half + Math.sin(angle) * d;
      const t = (p0 + phase) % 1;
      const tw = 0.3 + 0.7 * Math.max(0, Math.sin(t * Math.PI * 2));
      const armLen = size * 0.05;
      // Halo
      ctx.globalAlpha = tw * 0.15;
      ctx.fillStyle = 'rgb(255,250,200)';
      fillCircle(ctx, x, y, armLen * 0.9);
      // Cross arms
      ctx.strokeStyle = 'rgb(255,253,224)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = tw * 0.8;
      drawLine(ctx, x - armLen, y, x + armLen, y);
      drawLine(ctx, x, y - armLen, x, y + armLen);
      // Diagonals
      const diagLen = armLen * 0.55;
      ctx.lineWidth = 1;
      ctx.globalAlpha = tw * 0.5;
      drawLine(ctx, x - diagLen, y - diagLen, x + diagLen, y + diagLen);
      drawLine(ctx, x - diagLen, y + diagLen, x + diagLen, y - diagLen);
      // Center dot
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = 'rgb(255,255,240)';
      fillCircle(ctx, x, y, size * 0.008);
    }
  },
};

/** StormSurge — 风暴潮涌: chaotic storm particles */
export const drawStormSurge: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0]) {
    const N = 10;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const angle0 = (i / N) * Math.PI * 2;
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const angle = angle0 + t * Math.PI * 5;
      const dist = size * 0.15 + t * size * 0.35;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = i % 2 === 0 ? 'rgb(100,150,200)' : 'rgb(150,180,220)';
      fillCircle(ctx, x, y, size * 0.008);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// T–W
// ═══════════════════════════════════════════════════════════════════════════════

/** ThornVine — 荆棘缠绕: growing thorny vines */
export const drawThornVine: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0]) {
    const COUNT = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < COUNT; i++) {
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const startY = size;
      const endY = size * (1 - t * 0.8);
      const xBase = size * (0.25 + i * 0.25);
      const amp = size * 0.05 * Math.sin(t * Math.PI * 3);
      const alpha = Math.sin(t * Math.PI) * 0.5;
      // Vine path
      const d = `M ${xBase} ${startY} Q ${xBase + amp} ${(startY + endY) / 2} ${xBase - amp * 0.5} ${endY}`;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(40,100,30)';
      ctx.lineWidth = 2;
      strokePath(ctx, d);
      // Thorns
      const thornY = (startY + endY) / 2;
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = 'rgb(80,40,20)';
      ctx.lineWidth = 1;
      drawLine(
        ctx,
        xBase + amp * 0.5,
        thornY,
        xBase + amp * 0.5 + size * 0.015,
        thornY - size * 0.01,
      );
      drawLine(
        ctx,
        xBase + amp * 0.5,
        thornY + size * 0.03,
        xBase + amp * 0.5 - size * 0.012,
        thornY + size * 0.03 - size * 0.01,
      );
    }
    ctx.lineCap = 'butt';
  },
};

/** ThunderBolt — 雷鸣电闪: jagged lightning bolts */
export const drawThunderBolt: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const N = 6;
    const half = size / 2;
    const innerR = size * 0.38;
    const outerR = size * 0.52;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      const phase = i / N;
      const offsets = Array.from(
        { length: 5 },
        (_, s) => (s % 2 === 0 ? 1 : -1) * (0.03 + ((i * 7 + s * 3) % 5) * 0.012),
      );
      const intensity = (p0 + phase) % 1;
      const cycle = intensity;
      const flash = cycle < 0.15 ? cycle / 0.15 : cycle < 0.4 ? 1 - (cycle - 0.15) / 0.25 : 0;
      if (flash < 0.01) continue;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const perpX = -sinA;
      const perpY = cosA;
      // Build bolt path
      let d = '';
      for (let s = 0; s <= 4; s++) {
        const frac = s / 4;
        const r = innerR + frac * (outerR - innerR);
        const lat = offsets[s]! * size;
        const px = half + cosA * r + perpX * lat;
        const py = half + sinA * r + perpY * lat;
        d += s === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      // Layer 1: outer glow
      ctx.globalAlpha = flash * 0.25;
      ctx.strokeStyle = 'rgb(80,160,255)';
      ctx.lineWidth = size * 0.05;
      strokePath(ctx, d);
      // Layer 2: mid
      ctx.globalAlpha = flash * 0.5;
      ctx.strokeStyle = 'rgb(140,200,255)';
      ctx.lineWidth = size * 0.025;
      strokePath(ctx, d);
      // Layer 3: core
      ctx.globalAlpha = flash * 0.9;
      ctx.strokeStyle = 'rgb(220,240,255)';
      ctx.lineWidth = size * 0.012;
      strokePath(ctx, d);
      // Tip spark
      const tipR = innerR + (outerR - innerR);
      const tipX = half + cosA * tipR + perpX * offsets[4]! * size;
      const tipY = half + sinA * tipR + perpY * offsets[4]! * size;
      ctx.globalAlpha = flash * 0.7;
      ctx.fillStyle = 'rgb(255,255,255)';
      fillCircle(ctx, tipX, tipY, size * 0.015 * flash);
    }
  },
};

/** ThunderClap — 惊雷一击: single burst lightning flash */
export const drawThunderClap: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const half = size / 2;
    // Main flash timing
    const cycle = p0;
    const flash = cycle < 0.1 ? cycle / 0.1 : cycle < 0.25 ? 1 - (cycle - 0.1) / 0.15 : 0;
    if (flash < 0.01) return;
    // Radial bolts
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + p0 * 0.5;
      const dist = size * 0.15 + size * 0.3 * flash;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      ctx.globalAlpha = flash * 0.6;
      ctx.strokeStyle = 'rgb(200,230,255)';
      ctx.lineWidth = size * 0.01;
      drawLine(ctx, half, half, x, y);
    }
    // Center burst
    ctx.globalAlpha = flash * 0.4;
    ctx.fillStyle = 'rgb(220,240,255)';
    fillCircle(ctx, half, half, size * 0.06 * flash);
  },
};

/** TidePool — 潮汐水洼: expanding ring ripples */
export const drawTidePool: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const COUNT = 4;
    const half = size / 2;
    for (let i = 0; i < COUNT; i++) {
      const phase = i / COUNT;
      const t = (p0 + phase) % 1;
      const r = size * 0.05 + t * size * 0.4;
      const alpha = (1 - t) * 0.35;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgb(80,160,200)';
      ctx.lineWidth = 1.5 * (1 - t);
      strokeCircle(ctx, half, half, r);
    }
  },
};

/** VenomDrip — 毒液滴落: dripping venom drops */
export const drawVenomDrip: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0]) {
    const N = 5;
    for (let i = 0; i < N; i++) {
      const xFrac = 0.15 + (i * 0.7) / (N - 1);
      const phase = i / N;
      const t = (p0 + phase) % 1;
      const x = xFrac * size;
      const y = t * size;
      const r = size * 0.015 * (1 + t * 0.3);
      const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.7;
      // Drop
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgb(50,180,50)';
      fillCircle(ctx, x, y, r);
      // Trail
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = 'rgb(30,150,30)';
      ctx.lineWidth = size * 0.005;
      drawLine(ctx, x, Math.max(0, y - size * 0.08), x, y - size * 0.01);
    }
  },
};

/** WillowWisp — 柳树鬼火: wandering will-o-wisps */
export const drawWillowWisp: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0]) {
    const N = 5;
    const half = size / 2;
    for (let i = 0; i < N; i++) {
      const seed = ((i * 3 + 1) % 5) / 5;
      const phase = i / N;
      const t = p0;
      const angle =
        seed * Math.PI * 2 + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 3 + phase * 8) * 0.4;
      const dist =
        (0.25 + seed * 0.15) * size + Math.sin(t * Math.PI * 2 + phase * 6) * size * 0.04;
      const x = half + Math.cos(angle) * dist;
      const y = half + Math.sin(angle) * dist;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + phase * 5) * Math.PI));
      // Glow
      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = 'rgb(100,220,180)';
      fillCircle(ctx, x, y, size * 0.035);
      // Core
      ctx.globalAlpha = pulse * 0.8;
      ctx.fillStyle = 'rgb(150,255,200)';
      fillCircle(ctx, x, y, size * 0.012);
    }
  },
};

/** WindGust — 疾风粒子: horizontal wind streaks */
export const drawWindGust: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0]) {
    const N = 8;
    const half = size / 2;
    const safe = size * 0.22;
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const yFrac = 0.1 + (i / N) * 0.8;
      const phase = i / N;
      const speed = 1.2 + (i % 3) * 0.3;
      const rFrac = 0.008 + (i % 4) * 0.003;
      const tt = (p0 * speed + phase) % 1;
      const x = tt * size;
      const baseY = yFrac * size;
      const y = baseY + Math.sin(tt * Math.PI * 3) * size * 0.04;
      const dx = x - half;
      const dy = y - half;
      const tooClose = dx * dx + dy * dy < safe * safe;
      if (tooClose) continue;
      const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 0.5;
      const streakLen = size * 0.04;
      // Streak line
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = 'rgb(180,230,200)';
      ctx.lineWidth = rFrac * size * 2;
      drawLine(ctx, x, y, x - streakLen, y + 0.5);
      // Dot
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = 'rgb(200,245,220)';
      fillCircle(ctx, x, y, rFrac * size);
    }
    ctx.lineCap = 'butt';
  },
};
