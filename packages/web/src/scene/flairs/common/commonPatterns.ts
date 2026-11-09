/**
 * The ten common flair patterns (simple single animations), each coloured by a palette entry.
 * Samplers are ported verbatim from the React Native client's `seatFlairs/common` templates and
 * are shared by every colour.
 */
import type { DecorationNode, DotSampler, LineSampler, RingSampler } from '@/scene/decoration';

import type { FlairColorSet } from './palette';

export type FlairTemplate = (colors: FlairColorSet) => readonly DecorationNode[];

// ── Pulse: three spots swell and fade ────────────────────────────────────────

const PULSE_MS = 2500;
const PULSE_SPOTS = [
  { xFrac: 0.3, yFrac: 0.3, rFrac: 0.04, phase: 0 },
  { xFrac: 0.7, yFrac: 0.55, rFrac: 0.035, phase: 0.4 },
  { xFrac: 0.45, yFrac: 0.75, rFrac: 0.03, phase: 0.75 },
] as const;

const PULSE_SAMPLERS: readonly DotSampler[] = PULSE_SPOTS.map((spot) => (t, size) => {
  const pulse = Math.sin(t * Math.PI * 2);
  const alpha = 0.15 + (pulse + 1) * 0.25;
  const r = size * spot.rFrac * (0.7 + (pulse + 1) * 0.3);
  return { cx: spot.xFrac * size, cy: spot.yFrac * size, r, opacity: alpha };
});

export const pulseTemplate: FlairTemplate = (colors) =>
  PULSE_SPOTS.map((spot, i) => ({
    kind: 'dot',
    sample: PULSE_SAMPLERS[i]!,
    durationMs: PULSE_MS,
    phase: spot.phase,
    color: colors.rgb,
  }));

// ── Glow: four corners breathe in turn ───────────────────────────────────────

const GLOW_MS = 3000;
const GLOW_CORNERS = [
  { xFrac: 0.12, yFrac: 0.12, phase: 0 },
  { xFrac: 0.88, yFrac: 0.12, phase: 0.25 },
  { xFrac: 0.88, yFrac: 0.88, phase: 0.5 },
  { xFrac: 0.12, yFrac: 0.88, phase: 0.75 },
] as const;

const GLOW_SAMPLERS: readonly DotSampler[] = GLOW_CORNERS.map((corner) => (t, size) => ({
  cx: corner.xFrac * size,
  cy: corner.yFrac * size,
  r: size * 0.04,
  opacity: 0.3 + Math.sin(t * Math.PI * 2) * 0.3,
}));

export const glowTemplate: FlairTemplate = (colors) =>
  GLOW_CORNERS.map((corner, i) => ({
    kind: 'dot',
    sample: GLOW_SAMPLERS[i]!,
    durationMs: GLOW_MS,
    phase: corner.phase,
    color: colors.rgbLight,
  }));

// ── Sparkle: four corner stars blink ─────────────────────────────────────────

const SPARKLE_MS = 2800;
const SPARKLE_ARM_STROKE = 0.8;
const SPARKLE_SEEDS = [
  { x: 0.1, y: 0.1, phase: 0 },
  { x: 0.9, y: 0.15, phase: 0.25 },
  { x: 0.85, y: 0.9, phase: 0.5 },
  { x: 0.15, y: 0.85, phase: 0.75 },
] as const;

function blinkAt(t: number): number {
  const blink = Math.sin(t * Math.PI * 2);
  return blink > 0 ? blink : 0;
}

const SPARKLE_DOT_SAMPLERS: readonly DotSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => ({
  cx: seed.x * size,
  cy: seed.y * size,
  r: size * 0.012,
  opacity: blinkAt(t) * 0.7,
}));

const SPARKLE_H_ARM_SAMPLERS: readonly LineSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const arm = size * 0.025;
  const cx = seed.x * size;
  const cy = seed.y * size;
  return {
    x1: cx - arm,
    y1: cy,
    x2: cx + arm,
    y2: cy,
    strokeWidth: SPARKLE_ARM_STROKE,
    opacity: blinkAt(t) * 0.5,
  };
});

const SPARKLE_V_ARM_SAMPLERS: readonly LineSampler[] = SPARKLE_SEEDS.map((seed) => (t, size) => {
  const arm = size * 0.025;
  const cx = seed.x * size;
  const cy = seed.y * size;
  return {
    x1: cx,
    y1: cy - arm,
    x2: cx,
    y2: cy + arm,
    strokeWidth: SPARKLE_ARM_STROKE,
    opacity: blinkAt(t) * 0.5,
  };
});

export const sparkleTemplate: FlairTemplate = (colors) =>
  SPARKLE_SEEDS.flatMap((seed, i): DecorationNode[] => [
    {
      kind: 'dot',
      sample: SPARKLE_DOT_SAMPLERS[i]!,
      durationMs: SPARKLE_MS,
      phase: seed.phase,
      color: colors.rgbLight,
    },
    {
      kind: 'line',
      sample: SPARKLE_H_ARM_SAMPLERS[i]!,
      durationMs: SPARKLE_MS,
      phase: seed.phase,
      color: colors.rgbLight,
    },
    {
      kind: 'line',
      sample: SPARKLE_V_ARM_SAMPLERS[i]!,
      durationMs: SPARKLE_MS,
      phase: seed.phase,
      color: colors.rgbLight,
    },
  ]);

// ── Breathe: three dots with halos swell together ────────────────────────────

const BREATHE_MS = 3200;
const BREATHE_DOTS = [
  { xFrac: 0.28, yFrac: 0.25, rFrac: 0.055, phase: 0 },
  { xFrac: 0.72, yFrac: 0.42, rFrac: 0.045, phase: 0.33 },
  { xFrac: 0.4, yFrac: 0.72, rFrac: 0.05, phase: 0.66 },
] as const;

const BREATHE_CORE_SAMPLERS: readonly DotSampler[] = BREATHE_DOTS.map((dot) => (t, size) => {
  const breath = Math.sin(t * Math.PI * 2);
  return {
    cx: dot.xFrac * size,
    cy: dot.yFrac * size,
    r: size * dot.rFrac * (0.85 + breath * 0.15),
    opacity: 0.2 + breath * 0.35,
  };
});

const BREATHE_HALO_SAMPLERS: readonly DotSampler[] = BREATHE_DOTS.map((dot) => (t, size) => ({
  cx: dot.xFrac * size,
  cy: dot.yFrac * size,
  r: size * dot.rFrac * 1.8,
  opacity: 0.08 + Math.sin(t * Math.PI * 2) * 0.12,
}));

export const breatheTemplate: FlairTemplate = (colors) =>
  BREATHE_DOTS.flatMap((dot, i): DecorationNode[] => [
    {
      kind: 'dot',
      sample: BREATHE_HALO_SAMPLERS[i]!,
      durationMs: BREATHE_MS,
      phase: dot.phase,
      color: colors.rgbLight,
    },
    {
      kind: 'dot',
      sample: BREATHE_CORE_SAMPLERS[i]!,
      durationMs: BREATHE_MS,
      phase: dot.phase,
      color: colors.rgb,
    },
  ]);

// ── Float: a dot traces a Lissajous curve with a trailing echo ───────────────

const FLOAT_MS = 4000;
const FLOAT_TRAIL_LAG = 0.04;

function lissajous(t: number, size: number): { cx: number; cy: number } {
  const theta = t * Math.PI * 2;
  const amp = size * 0.28;
  return {
    cx: size / 2 + Math.sin(theta * 3) * amp * 0.8,
    cy: size / 2 + Math.cos(theta * 2) * amp * 0.7,
  };
}

const floatHeadSampler: DotSampler = (t, size) => ({
  ...lissajous(t, size),
  r: size * 0.02,
  opacity: 0.4 + Math.sin(t * Math.PI * 2 * 4) * 0.25,
});

const floatTrailSampler: DotSampler = (t, size) => ({
  ...lissajous((t - FLOAT_TRAIL_LAG + 1) % 1, size),
  r: size * 0.015,
  opacity: 0.18,
});

export const floatTemplate: FlairTemplate = (colors) => [
  { kind: 'dot', sample: floatTrailSampler, durationMs: FLOAT_MS, color: colors.rgbLight },
  { kind: 'dot', sample: floatHeadSampler, durationMs: FLOAT_MS, color: colors.rgb },
];

// ── Ripple: two rings expand from one point ──────────────────────────────────

const RIPPLE_MS = 2800;
const RIPPLE_MAX_R = 0.32;

const ripple1Sampler: RingSampler = (t, size) => ({
  cx: size * 0.45,
  cy: size * 0.48,
  r: size * 0.04 + t * size * RIPPLE_MAX_R,
  strokeWidth: 1.5,
  opacity: (1 - t) * 0.45,
});

const ripple2Sampler: RingSampler = (t, size) => ({
  cx: size * 0.45,
  cy: size * 0.48,
  r: size * 0.04 + t * size * RIPPLE_MAX_R,
  strokeWidth: 1,
  opacity: (1 - t) * 0.35,
});

export const rippleTemplate: FlairTemplate = (colors) => [
  { kind: 'ring', sample: ripple1Sampler, durationMs: RIPPLE_MS, color: colors.rgb },
  {
    kind: 'ring',
    sample: ripple2Sampler,
    durationMs: RIPPLE_MS,
    phase: 0.5,
    color: colors.rgbLight,
  },
];

// ── Orbit: two dots circle in opposite directions ────────────────────────────

const ORBIT_MS = 5000;

const orbit1Sampler: DotSampler = (t, size) => {
  const angle = t * Math.PI * 2;
  const r = size * 0.38;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.018,
    opacity: 0.55,
  };
};

const orbit2Sampler: DotSampler = (t, size) => {
  const angle = t * Math.PI * 2 * -1.5 + Math.PI;
  const r = size * 0.28;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.014,
    opacity: 0.4,
  };
};

export const orbitTemplate: FlairTemplate = (colors) => [
  { kind: 'dot', sample: orbit1Sampler, durationMs: ORBIT_MS, color: colors.rgb },
  { kind: 'dot', sample: orbit2Sampler, durationMs: ORBIT_MS, color: colors.rgbLight },
];

// ── Flicker: a candle-like core flickers inside a halo ───────────────────────

const FLICKER_MS = 1800;

const flickerCoreSampler: DotSampler = (t, size) => {
  const a = Math.sin(t * Math.PI * 2) * 0.3;
  const b = Math.sin(t * Math.PI * 6) * 0.15;
  return {
    cx: size / 2,
    cy: size / 2,
    r: size * 0.03 + Math.sin(t * Math.PI * 4) * size * 0.008,
    opacity: Math.max(0, 0.35 + a + b),
  };
};

const flickerHaloSampler: DotSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: size * 0.06,
  opacity: Math.max(0, 0.15 + Math.sin(t * Math.PI * 2) * 0.15),
});

export const flickerTemplate: FlairTemplate = (colors) => [
  { kind: 'dot', sample: flickerHaloSampler, durationMs: FLICKER_MS, color: colors.rgbLight },
  { kind: 'dot', sample: flickerCoreSampler, durationMs: FLICKER_MS, color: colors.rgb },
];

// ── Drift: a dot traces a figure eight (lemniscate of Bernoulli) ─────────────

const DRIFT_MS = 4200;

const driftSampler: DotSampler = (t, size) => {
  const theta = t * Math.PI * 2;
  const a = size * 0.18;
  const denom = 1 + Math.sin(theta) * Math.sin(theta);
  return {
    cx: size / 2 + (a * Math.cos(theta)) / denom,
    cy: size / 2 + (a * Math.sin(theta) * Math.cos(theta)) / denom,
    r: size * 0.016,
    opacity: 0.5,
  };
};

export const driftTemplate: FlairTemplate = (colors) => [
  { kind: 'dot', sample: driftSampler, durationMs: DRIFT_MS, color: colors.rgb },
];

// ── Wave: a diagonal streak sweeps across ────────────────────────────────────

const WAVE_MS = 4200;
/** Diagonal streak length as a fraction of the tile. */
const WAVE_STREAK_LEN = 0.25;

const waveStreakSampler: LineSampler = (t, size) => {
  const cx = size * (0.15 + t * 0.7);
  const cy = size * 0.45;
  const half = (size * WAVE_STREAK_LEN) / 2;
  return {
    x1: cx - half * 0.5,
    y1: cy - half,
    x2: cx + half * 0.5,
    y2: cy + half,
    strokeWidth: 1.5,
    opacity: Math.sin(t * Math.PI) * 0.3,
  };
};

export const waveTemplate: FlairTemplate = (colors) => [
  { kind: 'line', sample: waveStreakSampler, durationMs: WAVE_MS, color: colors.rgb },
];
