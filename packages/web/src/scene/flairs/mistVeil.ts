/** Mist Veil: 5 large translucent mist clouds drift past, each with a brighter inner core. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 7000;
const FOG_COUNT = 5;

const FOG_SEEDS = Array.from({ length: FOG_COUNT }, (_, i) => ({
  startX: -0.1 + (i % 2) * 0.1,
  yBase: 0.2 + (i * 0.6) / (FOG_COUNT - 1),
  phase: i / FOG_COUNT,
  rFrac: 0.12 + (i % 3) * 0.04,
}));

type FogSeed = (typeof FOG_SEEDS)[number];

function fogCentre(t: number, size: number, seed: FogSeed): { x: number; y: number; fade: number } {
  const x = (seed.startX + t * 1.2 - 0.1) * size;
  const y = seed.yBase * size + Math.sin(t * Math.PI * 2) * size * 0.04;
  const fadeIn = Math.min(t * 5, 1);
  const fadeOut = Math.min((1 - t) * 5, 1);
  return { x, y, fade: fadeIn * fadeOut };
}

function fogSampler(seed: FogSeed, radiusMul: number, opacityMul: number): DotSampler {
  return (t, size) => {
    const { x, y, fade } = fogCentre(t, size, seed);
    return { cx: x, cy: y, r: seed.rFrac * size * radiusMul, opacity: fade * opacityMul };
  };
}

const nodes = FOG_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'dot',
    sample: fogSampler(seed, 1, 0.06),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(200,210,220)',
  },
  {
    kind: 'dot',
    sample: fogSampler(seed, 0.4, 0.12),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(230,235,245)',
  },
]);

export const mistVeilFlair: DecorationSpec = { id: 'mistVeil', nodes };
