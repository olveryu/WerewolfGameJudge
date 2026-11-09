/**
 * Firefly Night: 8 fireflies wander around the perimeter with staggered blinks and a warm halo.
 * The seed phase offsets the wander and blink rhythms, not time, so it stays in the sampler.
 */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 8;

const FIREFLY_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.32 + (i % 4) * 0.05,
  phase: i / N,
  wander: 0.15 + (i % 3) * 0.08,
}));

type FireflySeed = (typeof FIREFLY_SEEDS)[number];

function createFireflySampler(seed: FireflySeed, rFrac: number, alphaMul: number): DotSampler {
  return (t, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const angle =
      seed.angle0 +
      Math.sin((t * 1.5 + seed.phase * 7) * Math.PI) * seed.wander +
      t * Math.PI * 0.3;
    const dist = seed.dist * size + Math.sin((t * 2.5 + seed.phase * 5) * Math.PI) * size * 0.04;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const blink = Math.max(0, Math.sin((t * 4 + seed.phase * 8) * Math.PI));
    const alpha = 0.1 + blink * 0.7;
    return { cx: x, cy: y, r: size * rFrac, opacity: alpha * alphaMul };
  };
}

const nodes = FIREFLY_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'dot',
    sample: createFireflySampler(seed, 0.03, 0.25),
    durationMs: LOOP_MS,
    color: 'rgb(200,230,60)',
  },
  {
    kind: 'dot',
    sample: createFireflySampler(seed, 0.012, 0.9),
    durationMs: LOOP_MS,
    color: 'rgb(230,255,100)',
  },
]);

export const fireflyFlair: DecorationSpec = { id: 'firefly', nodes };
