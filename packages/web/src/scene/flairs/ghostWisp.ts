/**
 * Ghost Wisps: 5 blue-white wisps drift erratically around the perimeter, each with a glow halo
 * and a 3-segment trail. The seed phase offsets the drift and pulse, not time.
 */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 5000;
const N = 5;

const WISP_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2,
  phase: i / N,
  orbitR: 0.3 + (i % 3) * 0.06,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

/** Trail segment `k` sits `k × 0.15` rad back and `k × 2` px inward. */
const TAILS = [
  { k: 1, rFrac: 0.011, alphaMul: 0.3 },
  { k: 2, rFrac: 0.008, alphaMul: 0.2 },
  { k: 3, rFrac: 0.005, alphaMul: 0.1 },
] as const;

function wispFrame(seed: WispSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle + t * Math.PI * 1.5 + Math.sin(t * Math.PI * 4 + seed.phase * 10) * 0.3;
  const dist = seed.orbitR * size + Math.sin(t * Math.PI * 3 + seed.phase * 8) * size * 0.04;
  const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2.5 + seed.phase * 6) * Math.PI));
  return { cx, cy, angle, dist, pulse };
}

function headSampler(seed: WispSeed, rFrac: number, alphaMul: number): DotSampler {
  return (t, size) => {
    const { cx, cy, angle, dist, pulse } = wispFrame(seed, t, size);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    return { cx: x, cy: y, r: size * rFrac, opacity: pulse * alphaMul };
  };
}

function tailSampler(seed: WispSeed, tail: (typeof TAILS)[number]): DotSampler {
  return (t, size) => {
    const { cx, cy, angle, dist, pulse } = wispFrame(seed, t, size);
    const ta = angle - tail.k * 0.15;
    const td = dist - tail.k * 2;
    return {
      cx: cx + Math.cos(ta) * td,
      cy: cy + Math.sin(ta) * td,
      r: size * tail.rFrac,
      opacity: Math.max(0, pulse * tail.alphaMul),
    };
  };
}

const nodes = WISP_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'dot',
    sample: headSampler(seed, 0.04, 0.25),
    durationMs: LOOP_MS,
    color: 'rgb(100,200,255)',
  },
  {
    kind: 'dot',
    sample: headSampler(seed, 0.018, 0.9),
    durationMs: LOOP_MS,
    color: 'rgb(180,230,255)',
  },
  ...TAILS.map(
    (tail): DecorationNode => ({
      kind: 'dot',
      sample: tailSampler(seed, tail),
      durationMs: LOOP_MS,
      color: 'rgb(100,200,255)',
    }),
  ),
]);

export const ghostWispFlair: DecorationSpec = { id: 'ghostWisp', nodes };
