/** Lava Burst: 5 lava blobs erupt from the bottom on parabolas with a 3-dot spark trail. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 3500;
const BLOB_COUNT = 5;
const COLORS = [
  'rgb(255,80,0)',
  'rgb(255,120,20)',
  'rgb(255,60,10)',
  'rgb(255,100,0)',
  'rgb(255,140,40)',
] as const;

const BLOB_SEEDS = Array.from({ length: BLOB_COUNT }, (_, i) => ({
  xBase: 0.3 + (i * 0.4) / (BLOB_COUNT - 1),
  vx: (i % 2 === 0 ? 1 : -1) * (0.05 + i * 0.02),
  vy: 0.8 + (i % 3) * 0.15,
  phase: i / BLOB_COUNT,
  rFrac: 0.02 + (i % 3) * 0.006,
  ci: i % COLORS.length,
}));

type BlobSeed = (typeof BLOB_SEEDS)[number];

/** Trail dots lag the blob by `lag` of the loop and shrink and dim per step (back to front). */
const TRAILS = [
  { lag: 0.12, rScale: 0.2, opacity: 0.1 },
  { lag: 0.08, rScale: 0.35, opacity: 0.2 },
  { lag: 0.04, rScale: 0.6, opacity: 0.4 },
] as const;

function getPos(seed: BlobSeed, size: number, t: number): { x: number; y: number } {
  const gravity = size * 1.2;
  const x = seed.xBase * size + seed.vx * size * t;
  const y = size - (seed.vy * size * t - 0.5 * gravity * t * t);
  return { x, y };
}

function mainSampler(seed: BlobSeed): DotSampler {
  return (t, size) => {
    const { x, y } = getPos(seed, size, t);
    const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.8;
    return { cx: x, cy: y, r: seed.rFrac * size, opacity: alpha };
  };
}

function trailSampler(seed: BlobSeed, trail: (typeof TRAILS)[number]): DotSampler {
  return (t, size) => {
    const { x, y } = getPos(seed, size, Math.max(0, t - trail.lag));
    return { cx: x, cy: y, r: seed.rFrac * size * trail.rScale, opacity: trail.opacity };
  };
}

const nodes = BLOB_SEEDS.flatMap((seed): DecorationNode[] => {
  const color = COLORS[seed.ci]!;
  return [
    ...TRAILS.map((trail): DecorationNode => ({
      kind: 'dot',
      sample: trailSampler(seed, trail),
      durationMs: LOOP_MS,
      phase: seed.phase,
      color,
    })),
    { kind: 'dot', sample: mainSampler(seed), durationMs: LOOP_MS, phase: seed.phase, color },
  ];
});

export const lavaBurstFlair: DecorationSpec = { id: 'lavaBurst', nodes };
