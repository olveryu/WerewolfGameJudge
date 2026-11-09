/** Arctic Wind: 6 horizontal streaks sweep right to left, each carrying a small ice crystal. */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const LOOP_MS = 3000;
const STREAK_COUNT = 6;

const STREAK_SEEDS = Array.from({ length: STREAK_COUNT }, (_, i) => ({
  yFrac: 0.15 + (i * 0.7) / (STREAK_COUNT - 1),
  phase: i / STREAK_COUNT,
  length: 0.15 + (i % 3) * 0.06,
}));

const STREAK_SAMPLERS: readonly LineSampler[] = STREAK_SEEDS.map((seed) => (t, size) => {
  const xStart = size * (1.1 - t * 1.3);
  const y = seed.yFrac * size + Math.sin(t * Math.PI * 3) * size * 0.02;
  return {
    x1: xStart,
    y1: y,
    x2: xStart - seed.length * size,
    y2: y,
    strokeWidth: size * 0.008,
    opacity: t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.35,
  };
});

const ICE_SAMPLERS: readonly DotSampler[] = STREAK_SEEDS.map((seed) => (t, size) => ({
  cx: size * (1.1 - t * 1.3) - seed.length * size * 0.5,
  cy: seed.yFrac * size + Math.sin(t * Math.PI * 3) * size * 0.02 - size * 0.015,
  r: size * 0.006,
  opacity: t < 0.15 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 0.45,
}));

const nodes = STREAK_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'line',
    sample: STREAK_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(180,220,255)',
  },
  {
    kind: 'dot',
    sample: ICE_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(220,240,255)',
  },
]);

export const arcticWindFlair: DecorationSpec = { id: 'arcticWind', nodes };
