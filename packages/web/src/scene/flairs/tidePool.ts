/** Tide Pool: 5 ripple sources fire in turn, each sending out 3 concentric fading rings. */
import type { DecorationNode, DecorationSpec, RingSampler } from '@/scene/decoration';

const LOOP_MS = 3500;
const RINGS_PER_RIPPLE = 3;

const RIPPLE_SEEDS = [
  { cx: 0.25, cy: 0.3, phase: 0 },
  { cx: 0.7, cy: 0.2, phase: 0.2 },
  { cx: 0.5, cy: 0.6, phase: 0.45 },
  { cx: 0.15, cy: 0.75, phase: 0.6 },
  { cx: 0.8, cy: 0.8, phase: 0.8 },
] as const;

type RippleSeed = (typeof RIPPLE_SEEDS)[number];

function createRingSampler(seed: RippleSeed, ri: number): RingSampler {
  const ringDelay = ri * 0.1;
  return (t, size) => {
    const localT = Math.max(0, t - ringDelay);
    const expansion = localT / (1 - ringDelay);
    const r = expansion * size * 0.12;
    const alpha = expansion < 0.05 ? expansion / 0.05 : (1 - expansion) * 0.2;
    return {
      cx: seed.cx * size,
      cy: seed.cy * size,
      r: Math.max(0, r),
      strokeWidth: size * (0.004 - ri * 0.001),
      opacity: Math.max(0, alpha),
    };
  };
}

const nodes = RIPPLE_SEEDS.flatMap((seed) =>
  Array.from({ length: RINGS_PER_RIPPLE }, (_, ri): DecorationNode => ({
    kind: 'ring',
    sample: createRingSampler(seed, ri),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(100,180,220)',
  })),
);

export const tidePoolFlair: DecorationSpec = { id: 'tidePool', nodes };
