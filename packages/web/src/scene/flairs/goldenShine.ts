/**
 * Golden Shine: 10 golden sparkles bloom and fade around the avatar, each a soft glow under a
 * bright core. Ported from the RN client's `GoldenShineFlair` samplers.
 */
import type { DecorationSpec, DotNode, DotSampler } from '@/scene/decoration';

const LOOP_MS = 3000;
const SPARKLE_COUNT = 10;
const GLOW_COLOR = 0xffdc64;
const CORE_COLOR = 0xffc832;

const SPARKLE_SEEDS = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  angle: (i / SPARKLE_COUNT) * Math.PI * 2 + i * 0.3,
  distance: 0.32 + (i % 4) * 0.06,
  phase: i / SPARKLE_COUNT,
  radiusFraction: 0.012 + (i % 3) * 0.006,
}));

type SparkleSeed = (typeof SPARKLE_SEEDS)[number];

function sparkleFrame(seed: SparkleSeed, t: number, size: number) {
  const centre = size / 2;
  const flash = Math.max(0, 1 - Math.abs(t - 0.3) * 5);
  const distance = seed.distance * size * (0.9 + flash * 0.2);
  return {
    x: centre + Math.cos(seed.angle) * distance,
    y: centre + Math.sin(seed.angle) * distance,
    r: seed.radiusFraction * size * (0.5 + flash),
    flash,
  };
}

function glowSampler(seed: SparkleSeed): DotSampler {
  return (t, size) => {
    const { x, y, r, flash } = sparkleFrame(seed, t, size);
    return { cx: x, cy: y, r: r * 2, opacity: flash < 0.01 ? 0 : flash * 0.3 };
  };
}

function coreSampler(seed: SparkleSeed): DotSampler {
  return (t, size) => {
    const { x, y, r, flash } = sparkleFrame(seed, t, size);
    return { cx: x, cy: y, r, opacity: flash < 0.01 ? 0 : flash * 0.9 };
  };
}

const nodes: DotNode[] = SPARKLE_SEEDS.flatMap((seed): DotNode[] => [
  {
    kind: 'dot',
    sample: glowSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: GLOW_COLOR,
  },
  {
    kind: 'dot',
    sample: coreSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: CORE_COLOR,
  },
]);

export const goldenShineFlair: DecorationSpec = { id: 'goldenShine', nodes };
