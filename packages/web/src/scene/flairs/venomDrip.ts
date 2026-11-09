/** Venom Drip: 5 venom droplets drip from the top with 3-dot trails and a landing splash ring. */
import type { DecorationNode, DecorationSpec, DotSampler, RingSampler } from '@/scene/decoration';

const LOOP_MS = 3500;
const DROP_COUNT = 5;

const DROP_SEEDS = Array.from({ length: DROP_COUNT }, (_, i) => ({
  xFrac: 0.2 + (i * 0.6) / (DROP_COUNT - 1),
  phase: i / DROP_COUNT,
  speed: 0.9 + (i % 2) * 0.1,
}));

type DropSeed = (typeof DROP_SEEDS)[number];

function mainSampler(seed: DropSeed): DotSampler {
  return (t, size) => {
    const y = t * seed.speed * size;
    const alpha = t > 0.85 ? (1 - t) / 0.15 : 0.7;
    return { cx: seed.xFrac * size, cy: y, r: size * 0.018, opacity: alpha };
  };
}

/** Trail dot `lagFrac` of the tile above the drop. */
function trailSampler(seed: DropSeed, lagFrac: number, rFrac: number, opacity: number): DotSampler {
  return (t, size) => {
    const y = Math.max(0, t * seed.speed * size - size * lagFrac);
    return { cx: seed.xFrac * size, cy: y, r: size * rFrac, opacity };
  };
}

function splashSampler(seed: DropSeed): RingSampler {
  return (t, size) => {
    const splashT = t > 0.85 ? (t - 0.85) / 0.15 : 0;
    return {
      cx: seed.xFrac * size,
      cy: size * 0.92,
      r: size * 0.03 * splashT,
      strokeWidth: 1,
      opacity: (1 - splashT) * 0.3,
    };
  };
}

const nodes = DROP_SEEDS.flatMap((seed): DecorationNode[] => {
  const timing = { durationMs: LOOP_MS, phase: seed.phase };
  return [
    {
      kind: 'dot',
      sample: trailSampler(seed, 0.12, 0.005, 0.1),
      ...timing,
      color: 'rgb(80,180,40)',
    },
    {
      kind: 'dot',
      sample: trailSampler(seed, 0.08, 0.008, 0.2),
      ...timing,
      color: 'rgb(80,180,40)',
    },
    {
      kind: 'dot',
      sample: trailSampler(seed, 0.04, 0.012, 0.4),
      ...timing,
      color: 'rgb(100,200,60)',
    },
    { kind: 'dot', sample: mainSampler(seed), ...timing, color: 'rgb(60,160,30)' },
    { kind: 'ring', sample: splashSampler(seed), ...timing, color: 'rgb(80,180,40)' },
  ];
});

export const venomDripFlair: DecorationSpec = { id: 'venomDrip', nodes };
