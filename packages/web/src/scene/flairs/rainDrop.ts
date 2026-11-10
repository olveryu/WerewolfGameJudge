/** Rain Drop: 12 slanted rain streaks fall, some splashing into small rings near the bottom. */
import type { DecorationNode, DecorationSpec, LineSampler, RingSampler } from '@/scene/decoration';

const LOOP_MS = 4000;
const N = 12;

/** Splash threshold on the per-drop clock `tt = (t × speed + phase) % 1`. */
const SPLASH_START = 0.85;

const RAIN_SEEDS = Array.from({ length: N }, (_, i) => {
  const phase = i / N;
  const speed = 0.7 + (i % 4) * 0.1;
  return {
    xFrac: 0.05 + (i * 0.9) / (N - 1),
    phase,
    lenFrac: 0.03 + (i % 3) * 0.015,
    speed,
    /** `tt` peaks at `speed + phase` within one loop; below the threshold no splash shows. */
    hasSplash: speed + phase > SPLASH_START,
  };
});

type RainSeed = (typeof RAIN_SEEDS)[number];

function streakSampler(seed: RainSeed): LineSampler {
  return (t, size) => {
    const tt = (t * seed.speed + seed.phase) % 1;
    const y = tt * size * 1.1 - size * 0.05;
    const x = seed.xFrac * size + tt * size * 0.08;
    const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.5;
    const len = seed.lenFrac * size;
    return { x1: x, y1: y, x2: x - 1, y2: y - len, opacity: alpha * 0.7, strokeWidth: 0.8 };
  };
}

function splashSampler(seed: RainSeed): RingSampler {
  return (t, size) => {
    const tt = (t * seed.speed + seed.phase) % 1;
    if (tt <= SPLASH_START) {
      return { cx: 0, cy: 0, r: 0, opacity: 0, strokeWidth: 0.5 };
    }
    const y = tt * size * 1.1 - size * 0.05;
    const x = seed.xFrac * size + tt * size * 0.08;
    const splash = (tt - SPLASH_START) / 0.15;
    const splashAlpha = (1 - splash) * 0.4;
    const splashR = splash * size * 0.02;
    return { cx: x, cy: y, r: splashR, opacity: splashAlpha, strokeWidth: 0.5 };
  };
}

const nodes = RAIN_SEEDS.flatMap((seed): DecorationNode[] => [
  { kind: 'line', sample: streakSampler(seed), durationMs: LOOP_MS, color: 'rgb(150,190,230)' },
  ...(seed.hasSplash
    ? [
        {
          kind: 'ring',
          sample: splashSampler(seed),
          durationMs: LOOP_MS,
          color: 'rgb(150,190,230)',
        } satisfies DecorationNode,
      ]
    : []),
]);

export const rainDropFlair: DecorationSpec = { id: 'rainDrop', nodes };
