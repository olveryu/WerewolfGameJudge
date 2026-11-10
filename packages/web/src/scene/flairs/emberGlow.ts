/** Ember Glow: 6 orange and amber embers rise from the bottom, fading as they ascend. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 4000;
const PARTICLE_COUNT = 6;
const COLORS = [
  'rgb(255,140,0)',
  'rgb(255,180,50)',
  'rgb(255,100,20)',
  'rgb(255,160,30)',
  'rgb(255,200,80)',
  'rgb(255,120,10)',
] as const;

const EMBER_SEEDS = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  xFrac: 0.15 + (i * 0.7) / (PARTICLE_COUNT - 1),
  phase: i / PARTICLE_COUNT,
  rFrac: 0.02 + (i % 3) * 0.008,
  ci: i % COLORS.length,
}));

const EMBER_SAMPLERS: readonly DotSampler[] = EMBER_SEEDS.map((seed) => (t, size) => {
  const y = size * (1 - t);
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 2) * size * 0.04;
  const r = seed.rFrac * size;
  const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
  return { cx: x, cy: y, r, opacity: alpha * 0.8 };
});

const nodes = EMBER_SEEDS.map(
  (seed, i): DecorationNode => ({
    kind: 'dot',
    sample: EMBER_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: COLORS[seed.ci]!,
  }),
);

export const emberGlowFlair: DecorationSpec = { id: 'emberGlow', nodes };
