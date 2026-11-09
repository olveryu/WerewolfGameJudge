/** Sandstorm: 10 sand grains whirl in a vortex at varying radii and speeds, each with dust. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 3000;
const GRAIN_COUNT = 10;
const COLORS = [
  'rgb(210,180,120)',
  'rgb(190,160,100)',
  'rgb(220,190,130)',
  'rgb(200,170,110)',
  'rgb(230,200,140)',
] as const;

const GRAIN_SEEDS = Array.from({ length: GRAIN_COUNT }, (_, i) => ({
  orbitR: 0.25 + (i % 4) * 0.07,
  angleOff: (i / GRAIN_COUNT) * Math.PI * 2,
  speed: 1 + (i % 3) * 0.4,
  phase: i / GRAIN_COUNT,
  rFrac: 0.008 + (i % 3) * 0.004,
  ci: i % COLORS.length,
}));

type GrainSeed = (typeof GRAIN_SEEDS)[number];

function grainSampler(
  seed: GrainSeed,
  angleLag: number,
  radiusMul: number,
  opacity: number,
): DotSampler {
  return (t, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const angle = t * Math.PI * 2 * seed.speed + seed.angleOff - angleLag;
    return {
      cx: cx + Math.cos(angle) * seed.orbitR * size,
      cy: cy + Math.sin(angle) * seed.orbitR * size,
      r: seed.rFrac * size * radiusMul,
      opacity,
    };
  };
}

const nodes = GRAIN_SEEDS.flatMap((seed): DecorationNode[] => {
  const color = COLORS[seed.ci]!;
  return [
    {
      kind: 'dot',
      sample: grainSampler(seed, 0.15, 1.5, 0.12),
      durationMs: LOOP_MS,
      phase: seed.phase,
      color,
    },
    {
      kind: 'dot',
      sample: grainSampler(seed, 0, 1, 0.6),
      durationMs: LOOP_MS,
      phase: seed.phase,
      color,
    },
  ];
});

export const sandStormFlair: DecorationSpec = { id: 'sandStormFlair', nodes };
