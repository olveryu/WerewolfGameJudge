/**
 * The five rare flair patterns (several elements, phase offsets, more particles), each coloured
 * by a palette entry. Ported verbatim from the React Native client's `seatFlairs/common`.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DotSampler,
  LineSampler,
  MorphArt,
  MorphSampler,
  StaticArt,
} from '@/scene/decoration';

import type { FlairTemplate } from './commonPatterns';

// ── Cascade: drops fall down both edges ──────────────────────────────────────

const CASCADE_MS = 3200;
const CASCADE_DOT_COUNT = 6;

const CASCADE_DROPS = Array.from({ length: CASCADE_DOT_COUNT }, (_, i) => ({
  phase: i / CASCADE_DOT_COUNT,
  /** Even indices fall on the left edge, odd on the right. */
  isLeft: i % 2 === 0,
}));

const CASCADE_SAMPLERS: readonly DotSampler[] = CASCADE_DROPS.map((drop) => (t, size) => {
  const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
  return {
    cx: drop.isLeft ? size * 0.12 : size * 0.88,
    cy: size * 0.1 + t * size * 0.8,
    r: size * 0.012,
    opacity: alpha * 0.45,
  };
});

export const cascadeTemplate: FlairTemplate = (colors) =>
  CASCADE_DROPS.map((drop, i) => ({
    kind: 'dot',
    sample: CASCADE_SAMPLERS[i]!,
    durationMs: CASCADE_MS,
    phase: drop.phase,
    color: drop.isLeft ? colors.rgb : colors.rgbLight,
  }));

// ── Vortex: particles spiral into the centre ─────────────────────────────────

const VORTEX_MS = 4000;
const VORTEX_PARTICLE_COUNT = 8;

const VORTEX_PARTICLES = Array.from({ length: VORTEX_PARTICLE_COUNT }, (_, i) => ({
  phase: i / VORTEX_PARTICLE_COUNT,
  isPrimary: i % 2 === 0,
}));

/** Each spiral is also rotated by its phase, so the samplers differ per particle. */
const VORTEX_SAMPLERS: readonly DotSampler[] = VORTEX_PARTICLES.map((particle) => (t, size) => {
  const angle = t * Math.PI * 4 + particle.phase * Math.PI * 2;
  const r = size * 0.38 * (1 - t);
  const alpha = t < 0.1 ? t / 0.1 : 1 - t;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.01,
    opacity: alpha * 0.5,
  };
});

export const vortexTemplate: FlairTemplate = (colors) =>
  VORTEX_PARTICLES.map((particle, i) => ({
    kind: 'dot',
    sample: VORTEX_SAMPLERS[i]!,
    durationMs: VORTEX_MS,
    phase: particle.phase,
    color: particle.isPrimary ? colors.rgb : colors.rgbLight,
  }));

// ── Constellation: fixed stars with links fading in turn ─────────────────────

const CONSTELLATION_MS = 5000;
const CONSTELLATION_LINK_STROKE = 0.8;

const STARS = [
  { x: 0.2, y: 0.15 },
  { x: 0.8, y: 0.2 },
  { x: 0.85, y: 0.75 },
  { x: 0.15, y: 0.8 },
  { x: 0.5, y: 0.5 },
] as const;

const LINKS: readonly [number, number][] = [
  [0, 4],
  [4, 1],
  [1, 2],
  [2, 4],
  [4, 3],
  [3, 0],
];

/** Each link fades in then out over its own segment of the loop. */
const LINK_SAMPLERS: readonly LineSampler[] = LINKS.map(([from, to]) => (t, size) => {
  const alpha = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
  return {
    x1: STARS[from]!.x * size,
    y1: STARS[from]!.y * size,
    x2: STARS[to]!.x * size,
    y2: STARS[to]!.y * size,
    strokeWidth: CONSTELLATION_LINK_STROKE,
    opacity: alpha * 0.35,
  };
});

export const constellationTemplate: FlairTemplate = (colors) => {
  const starsArt: StaticArt = (context, size) => {
    for (const star of STARS) {
      context
        .circle(star.x * size, star.y * size, size * 0.012)
        .fill({ color: colors.rgb, alpha: 0.5 });
    }
  };
  return [
    { kind: 'static', art: starsArt },
    ...LINKS.map((_, i): DecorationNode => ({
      kind: 'line',
      sample: LINK_SAMPLERS[i]!,
      durationMs: CONSTELLATION_MS,
      phase: i / LINKS.length,
      color: colors.rgbLight,
    })),
  ];
};

// ── Aurora: two ribbons wave along the top edge ──────────────────────────────

const AURORA_MS = 6000;
/** Static curves per ribbon; 8 across a 6 s loop keeps each cross-fade under a second. */
const RIBBON_VARIANTS = 8;

function arc1Path(t: number, size: number): string {
  const w = size;
  const yBase = size * 0.12;
  const amp = size * 0.06;
  const cp1y = yBase + Math.sin(t * Math.PI * 2) * amp;
  const cp2y = yBase + Math.sin(t * Math.PI * 2 + 1.5) * amp;
  return `M 0 ${yBase} C ${w * 0.3} ${cp1y}, ${w * 0.7} ${cp2y}, ${w} ${yBase}`;
}

function arc2Path(t: number, size: number): string {
  const w = size;
  const yBase = size * 0.16;
  const amp = size * 0.04;
  const cp1y = yBase + Math.sin(t * Math.PI * 2 + Math.PI) * amp;
  const cp2y = yBase + Math.sin(t * Math.PI * 2 + Math.PI + 1.2) * amp;
  return `M 0 ${yBase} C ${w * 0.25} ${cp1y}, ${w * 0.75} ${cp2y}, ${w} ${yBase}`;
}

const arc1Sampler: MorphSampler = (t) => ({ opacity: 0.35 + Math.sin(t * Math.PI * 2) * 0.1 });
const arc2Sampler: MorphSampler = (t) => ({ opacity: 0.2 + Math.sin(t * Math.PI * 2 + 1) * 0.1 });

export const auroraTemplate: FlairTemplate = (colors) => {
  const arc1Art: MorphArt = (context, k, size) => {
    context
      .path(svgPath(arc1Path(k / RIBBON_VARIANTS, size)))
      .stroke({ color: colors.rgb, width: 1.8, cap: 'round' });
  };
  const arc2Art: MorphArt = (context, k, size) => {
    context
      .path(svgPath(arc2Path(k / RIBBON_VARIANTS, size)))
      .stroke({ color: colors.rgbLight, width: 1.2, cap: 'round' });
  };
  return [
    {
      kind: 'morph',
      sample: arc1Sampler,
      durationMs: AURORA_MS,
      variantCount: RIBBON_VARIANTS,
      mode: 'crossfade',
      art: arc1Art,
    },
    {
      kind: 'morph',
      sample: arc2Sampler,
      durationMs: AURORA_MS,
      variantCount: RIBBON_VARIANTS,
      mode: 'crossfade',
      art: arc2Art,
    },
  ];
};

// ── Firefly: six fireflies wander and blink ──────────────────────────────────

const FIREFLY_MS = 7000;
const FIREFLY_SEEDS = [0.13, 0.47, 0.73, 0.29, 0.61, 0.89] as const;

const FIREFLY_SAMPLERS: readonly DotSampler[] = FIREFLY_SEEDS.map((seed) => {
  const freqX = 1.0 + seed * 2;
  const freqY = 0.8 + seed * 1.5;
  const freqBlink = 2 + seed * 3;
  return (t, size) => {
    const blink = Math.sin(t * Math.PI * 2 * freqBlink + seed * 5);
    return {
      cx: size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * freqX + seed * 10)),
      cy: size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * freqY + seed * 7)),
      r: size * 0.01,
      // Squared for a sharper blink
      opacity: 0.2 + blink * blink * 0.4,
    };
  };
});

export const fireflyTemplate: FlairTemplate = (colors) =>
  FIREFLY_SEEDS.map((_, i) => ({
    kind: 'dot',
    sample: FIREFLY_SAMPLERS[i]!,
    durationMs: FIREFLY_MS,
    color: i % 2 === 0 ? colors.rgb : colors.rgbLight,
  }));
