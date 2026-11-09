/** Ash Cloud: 10 ash grains drift in irregular Brownian motion, each a hazy halo over a core. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const ASH_COUNT = 10;

const ASH_SEEDS = Array.from({ length: ASH_COUNT }, (_, i) => ({
  cx0: 0.1 + (i % 5) * 0.2,
  cy0: 0.1 + Math.floor(i / 5) * 0.4,
  driftX: ((i % 3) - 1) * 0.06,
  driftY: -0.05 + (i % 2) * 0.03,
  phase: i / ASH_COUNT,
  rFrac: 0.006 + (i % 3) * 0.003,
}));

type AshSeed = (typeof ASH_SEEDS)[number];

function ashCentre(t: number, size: number, seed: AshSeed): { cx: number; cy: number } {
  const wobbleX = Math.sin(t * Math.PI * 3 + seed.driftX * 10) * size * 0.03;
  const wobbleY = Math.cos(t * Math.PI * 2.5 + seed.driftY * 8) * size * 0.025;
  const cx = seed.cx0 * size + seed.driftX * size * t + wobbleX;
  const cy = seed.cy0 * size + seed.driftY * size * t + wobbleY;
  return { cx, cy };
}

const HALO_SAMPLERS: readonly DotSampler[] = ASH_SEEDS.map((seed) => (t, size) => {
  const { cx, cy } = ashCentre(t, size, seed);
  const flicker = 0.08 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.05;
  return { cx, cy, r: seed.rFrac * size * 2.5, opacity: flicker };
});

const CORE_SAMPLERS: readonly DotSampler[] = ASH_SEEDS.map((seed) => (t, size) => {
  const { cx, cy } = ashCentre(t, size, seed);
  const flicker = 0.15 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.1;
  return { cx, cy, r: seed.rFrac * size, opacity: flicker };
});

const nodes = ASH_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'dot',
    sample: HALO_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(130,120,110)',
  },
  {
    kind: 'dot',
    sample: CORE_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(90,80,70)',
  },
]);

export const ashCloudFlair: DecorationSpec = { id: 'ashCloud', nodes };
