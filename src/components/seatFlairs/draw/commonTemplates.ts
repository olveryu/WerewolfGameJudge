/**
 * Draw functions for the 15 common/rare flair templates.
 *
 * Each function receives `colors` from FlairCanvas (via the palette).
 * 10 common patterns × 10 colors = 100 common entries.
 * 5 rare patterns × 10 colors = 50 rare entries.
 */
import type { FlairDrawConfig } from './types';
import { drawLine, fillCircle, strokeCircle, strokePath } from './utils';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON patterns (10)
// ═══════════════════════════════════════════════════════════════════════════════

/** PulseFlair — 脉冲: 2-3 spots pulsing in/out */
export const drawPulse: FlairDrawConfig = {
  durations: [2500],
  draw(ctx, size, [p0], colors) {
    const SPOTS = [
      { xFrac: 0.3, yFrac: 0.3, rFrac: 0.04, phase: 0 },
      { xFrac: 0.7, yFrac: 0.55, rFrac: 0.035, phase: 0.4 },
      { xFrac: 0.45, yFrac: 0.75, rFrac: 0.03, phase: 0.75 },
    ];
    ctx.fillStyle = colors!.rgb;
    for (const spot of SPOTS) {
      const t = (p0 + spot.phase) % 1;
      const pulse = Math.sin(t * Math.PI * 2);
      const alpha = 0.15 + (pulse + 1) * 0.25;
      const r = size * spot.rFrac * (0.7 + (pulse + 1) * 0.3);
      ctx.globalAlpha = alpha;
      fillCircle(ctx, spot.xFrac * size, spot.yFrac * size, r);
    }
  },
};

/** GlowFlair — 微光: 4 corner dots pulsing */
export const drawGlow: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0], colors) {
    const CORNERS = [
      { xFrac: 0.12, yFrac: 0.12, phase: 0 },
      { xFrac: 0.88, yFrac: 0.12, phase: 0.25 },
      { xFrac: 0.88, yFrac: 0.88, phase: 0.5 },
      { xFrac: 0.12, yFrac: 0.88, phase: 0.75 },
    ];
    ctx.fillStyle = colors!.rgbLight;
    for (const c of CORNERS) {
      const t = (p0 + c.phase) % 1;
      const pulse = 0.3 + Math.sin(t * Math.PI * 2) * 0.3;
      ctx.globalAlpha = pulse;
      fillCircle(ctx, c.xFrac * size, c.yFrac * size, size * 0.04);
    }
  },
};

/** SparkleFlair — 星点: blinking dots with cross arms */
export const drawSparkle: FlairDrawConfig = {
  durations: [3500],
  draw(ctx, size, [p0], colors) {
    const STARS = [
      { x: 0.2, y: 0.2, phase: 0 },
      { x: 0.75, y: 0.3, phase: 0.3 },
      { x: 0.5, y: 0.65, phase: 0.6 },
      { x: 0.3, y: 0.85, phase: 0.8 },
      { x: 0.85, y: 0.8, phase: 0.5 },
    ];
    for (const star of STARS) {
      const t = (p0 + star.phase) % 1;
      const blink = Math.sin(t * Math.PI * 2);
      if (blink <= 0) continue;
      const cx = star.x * size;
      const cy = star.y * size;
      const arm = size * 0.025;
      // Dot
      ctx.globalAlpha = blink * 0.7;
      ctx.fillStyle = colors!.rgb;
      fillCircle(ctx, cx, cy, size * 0.012);
      // Cross arms
      ctx.globalAlpha = blink * 0.5;
      ctx.strokeStyle = colors!.rgbLight;
      ctx.lineWidth = 0.8;
      drawLine(ctx, cx - arm, cy, cx + arm, cy);
      drawLine(ctx, cx, cy - arm, cx, cy + arm);
    }
  },
};

/** BreatheFlair — 呼吸: 3 bokeh dots breathing in/out */
export const drawBreathe: FlairDrawConfig = {
  durations: [3000],
  draw(ctx, size, [p0], colors) {
    const DOTS = [
      { xFrac: 0.28, yFrac: 0.25, rFrac: 0.055, phase: 0 },
      { xFrac: 0.72, yFrac: 0.42, rFrac: 0.045, phase: 0.33 },
      { xFrac: 0.4, yFrac: 0.72, rFrac: 0.05, phase: 0.66 },
    ];
    for (const dot of DOTS) {
      const t = (p0 + dot.phase) % 1;
      const breath = Math.sin(t * Math.PI * 2);
      // Core
      const coreAlpha = 0.2 + breath * 0.35;
      const coreR = size * dot.rFrac * (0.85 + breath * 0.15);
      ctx.globalAlpha = coreAlpha;
      ctx.fillStyle = colors!.rgb;
      fillCircle(ctx, dot.xFrac * size, dot.yFrac * size, coreR);
      // Halo
      const haloAlpha = 0.08 + breath * 0.12;
      ctx.globalAlpha = haloAlpha;
      ctx.fillStyle = colors!.rgbLight;
      fillCircle(ctx, dot.xFrac * size, dot.yFrac * size, size * dot.rFrac * 1.8);
    }
  },
};

/** FloatFlair — 浮点: Lissajous curve dot with trail */
export const drawFloat: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0], colors) {
    const t = p0 * Math.PI * 2;
    const amp = size * 0.28;
    const cx = size / 2 + Math.sin(t * 3) * amp * 0.8;
    const cy = size / 2 + Math.cos(t * 2) * amp * 0.7;
    // Trail
    const tTrail = ((p0 - 0.04 + 1) % 1) * Math.PI * 2;
    const tx = size / 2 + Math.sin(tTrail * 3) * amp * 0.8;
    const ty = size / 2 + Math.cos(tTrail * 2) * amp * 0.7;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = colors!.rgbLight;
    fillCircle(ctx, tx, ty, size * 0.015);
    // Main dot
    const alpha = 0.4 + Math.sin(t * 4) * 0.25;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors!.rgb;
    fillCircle(ctx, cx, cy, size * 0.02);
  },
};

/** RippleFlair — 涟漪: expanding rings from center */
export const drawRipple: FlairDrawConfig = {
  durations: [2800],
  draw(ctx, size, [p0], colors) {
    const MAX_R = 0.32;
    const cx = size * 0.45;
    const cy = size * 0.48;
    // Ring 1
    const r1 = size * 0.04 + p0 * size * MAX_R;
    ctx.globalAlpha = (1 - p0) * 0.45;
    ctx.strokeStyle = colors!.rgb;
    ctx.lineWidth = 1.5;
    strokeCircle(ctx, cx, cy, r1);
    // Ring 2 (phase offset)
    const t2 = (p0 + 0.5) % 1;
    const r2 = size * 0.04 + t2 * size * MAX_R;
    ctx.globalAlpha = (1 - t2) * 0.35;
    ctx.strokeStyle = colors!.rgbLight;
    ctx.lineWidth = 1;
    strokeCircle(ctx, cx, cy, r2);
  },
};

/** OrbitFlair — 轨道: 2 dots orbiting at different speeds */
export const drawOrbit: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0], colors) {
    const half = size / 2;
    // Dot 1: slow clockwise
    const a1 = p0 * Math.PI * 2;
    const r1 = size * 0.38;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = colors!.rgb;
    fillCircle(ctx, half + Math.cos(a1) * r1, half + Math.sin(a1) * r1, size * 0.018);
    // Dot 2: faster counter-clockwise
    const a2 = p0 * Math.PI * 2 * -1.5 + Math.PI;
    const r2 = size * 0.28;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = colors!.rgbLight;
    fillCircle(ctx, half + Math.cos(a2) * r2, half + Math.sin(a2) * r2, size * 0.014);
  },
};

/** FlickerFlair — 闪烁: center dot with irregular flicker */
export const drawFlicker: FlairDrawConfig = {
  durations: [1800],
  draw(ctx, size, [p0], colors) {
    const half = size / 2;
    const t = p0;
    // Core: irregular flicker
    const a = Math.sin(t * Math.PI * 2) * 0.3;
    const b = Math.sin(t * Math.PI * 6) * 0.15;
    const coreAlpha = Math.max(0, 0.35 + a + b);
    const coreR = size * 0.03 + Math.sin(t * Math.PI * 4) * size * 0.008;
    ctx.globalAlpha = coreAlpha;
    ctx.fillStyle = colors!.rgb;
    fillCircle(ctx, half, half, coreR);
    // Halo
    const haloAlpha = Math.max(0, 0.15 + Math.sin(t * Math.PI * 2) * 0.15);
    ctx.globalAlpha = haloAlpha;
    ctx.fillStyle = colors!.rgbLight;
    fillCircle(ctx, half, half, size * 0.06);
  },
};

/** DriftFlair — 飘浮: figure-8 (lemniscate) dot */
export const drawDrift: FlairDrawConfig = {
  durations: [4200],
  draw(ctx, size, [p0], colors) {
    const t = p0 * Math.PI * 2;
    const a = size * 0.18;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    const cx = size / 2 + (a * Math.cos(t)) / denom;
    const cy = size / 2 + (a * Math.sin(t) * Math.cos(t)) / denom;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colors!.rgb;
    fillCircle(ctx, cx, cy, size * 0.016);
  },
};

/** WaveFlair — 波纹: diagonal streak sweeping across */
export const drawWave: FlairDrawConfig = {
  durations: [4200],
  draw(ctx, size, [p0], colors) {
    const STREAK_LEN = 0.25;
    const t = p0;
    const cx = size * (0.15 + t * 0.7);
    const cy = size * 0.45;
    const half = (size * STREAK_LEN) / 2;
    const fade = Math.sin(t * Math.PI);
    ctx.globalAlpha = fade * 0.3;
    ctx.strokeStyle = colors!.rgb;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    drawLine(ctx, cx - half * 0.5, cy - half, cx + half * 0.5, cy + half);
    ctx.lineCap = 'butt';
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RARE patterns (5)
// ═══════════════════════════════════════════════════════════════════════════════

/** CascadeFlair — 瀑布: dots falling along left/right edges */
export const drawCascade: FlairDrawConfig = {
  durations: [3200],
  draw(ctx, size, [p0], colors) {
    const DOT_COUNT = 6;
    for (let i = 0; i < DOT_COUNT; i++) {
      const phase = i / DOT_COUNT;
      const side = i % 2 === 0;
      const t = (p0 + phase) % 1;
      const cx = side ? size * 0.12 : size * 0.88;
      const cy = size * 0.1 + t * size * 0.8;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = i % 2 === 0 ? colors!.rgb : colors!.rgbLight;
      fillCircle(ctx, cx, cy, size * 0.012);
    }
  },
};

/** VortexFlair — 旋涡: particles spiraling inward */
export const drawVortex: FlairDrawConfig = {
  durations: [4000],
  draw(ctx, size, [p0], colors) {
    const PARTICLE_COUNT = 8;
    const half = size / 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = i / PARTICLE_COUNT;
      const t = (p0 + phase) % 1;
      const angle = t * Math.PI * 4 + phase * Math.PI * 2;
      const r = size * 0.38 * (1 - t);
      const cx = half + Math.cos(angle) * r;
      const cy = half + Math.sin(angle) * r;
      const alpha = t < 0.1 ? t / 0.1 : 1 - t;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = i % 2 === 0 ? colors!.rgb : colors!.rgbLight;
      fillCircle(ctx, cx, cy, size * 0.01);
    }
  },
};

/** ConstellationFlair — 星座: fixed stars with animated connecting lines */
export const drawConstellation: FlairDrawConfig = {
  durations: [5000],
  draw(ctx, size, [p0], colors) {
    const STARS = [
      { x: 0.2, y: 0.15 },
      { x: 0.8, y: 0.2 },
      { x: 0.85, y: 0.75 },
      { x: 0.15, y: 0.8 },
      { x: 0.5, y: 0.5 },
    ];
    const LINKS: [number, number][] = [
      [0, 4],
      [4, 1],
      [1, 2],
      [2, 4],
      [4, 3],
      [3, 0],
    ];
    // Static stars
    ctx.fillStyle = colors!.rgb;
    ctx.globalAlpha = 0.5;
    for (const star of STARS) {
      fillCircle(ctx, star.x * size, star.y * size, size * 0.012);
    }
    // Animated lines
    ctx.strokeStyle = colors!.rgbLight;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < LINKS.length; i++) {
      const phase = i / LINKS.length;
      const t = (p0 + phase) % 1;
      const alpha = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.globalAlpha = alpha * 0.35;
      const [a, b] = LINKS[i]!;
      drawLine(ctx, STARS[a]!.x * size, STARS[a]!.y * size, STARS[b]!.x * size, STARS[b]!.y * size);
    }
  },
};

/** AuroraFlair — 极光: slow-breathing arcs over top edge */
export const drawAurora: FlairDrawConfig = {
  durations: [6000],
  draw(ctx, size, [p0], colors) {
    const w = size;
    ctx.lineCap = 'round';
    // Arc 1
    const yBase1 = size * 0.12;
    const amp1 = size * 0.06;
    const cp1y = yBase1 + Math.sin(p0 * Math.PI * 2) * amp1;
    const cp2y = yBase1 + Math.sin(p0 * Math.PI * 2 + 1.5) * amp1;
    ctx.globalAlpha = 0.35 + Math.sin(p0 * Math.PI * 2) * 0.1;
    ctx.strokeStyle = colors!.rgb;
    ctx.lineWidth = 1.8;
    strokePath(ctx, `M 0 ${yBase1} C ${w * 0.3} ${cp1y}, ${w * 0.7} ${cp2y}, ${w} ${yBase1}`);
    // Arc 2
    const yBase2 = size * 0.16;
    const amp2 = size * 0.04;
    const cp3y = yBase2 + Math.sin(p0 * Math.PI * 2 + Math.PI) * amp2;
    const cp4y = yBase2 + Math.sin(p0 * Math.PI * 2 + Math.PI + 1.2) * amp2;
    ctx.globalAlpha = 0.2 + Math.sin(p0 * Math.PI * 2 + 1) * 0.1;
    ctx.strokeStyle = colors!.rgbLight;
    ctx.lineWidth = 1.2;
    strokePath(ctx, `M 0 ${yBase2} C ${w * 0.25} ${cp3y}, ${w * 0.75} ${cp4y}, ${w} ${yBase2}`);
    ctx.lineCap = 'butt';
  },
};

/** FireflyFlair — 萤火: 6 fireflies with complex wander paths */
export const drawFirefly: FlairDrawConfig = {
  durations: [7000],
  draw(ctx, size, [p0], colors) {
    const SEEDS = [0.13, 0.47, 0.73, 0.29, 0.61, 0.89];
    const half = size / 2;
    const range = size * 0.35;
    for (let i = 0; i < 6; i++) {
      const seed = SEEDS[i]!;
      const freqX = 1.0 + seed * 2;
      const freqY = 0.8 + seed * 1.5;
      const freqBlink = 2 + seed * 3;
      const t = p0 * Math.PI * 2;
      const cx = half + Math.sin(t * freqX + seed * 10) * range;
      const cy = half + Math.cos(t * freqY + seed * 7) * range;
      const blink = Math.sin(t * freqBlink + seed * 5);
      const alpha = blink > 0 ? blink * 0.6 : 0;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors!.rgb;
      fillCircle(ctx, cx, cy, size * 0.01);
      // Glow halo
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = colors!.rgbLight;
      fillCircle(ctx, cx, cy, size * 0.025);
    }
  },
};
