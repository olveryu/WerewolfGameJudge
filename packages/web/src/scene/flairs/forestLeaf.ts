/**
 * Autumn Leaves: 7 orange-brown leaves spiral down, each two overlapping dots with a vein line.
 * The fall runs at 0.6× loop speed with the seed phase added before the wrap, so the phase stays
 * in the sampler.
 */
import type { DecorationNode, DecorationSpec, DotSampler, LineSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const N = 7;
const COLORS = [
  [180, 100, 30],
  [200, 120, 40],
  [160, 80, 20],
  [190, 110, 35],
  [170, 90, 25],
  [210, 130, 45],
  [175, 95, 28],
] as const;

const LEAF_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.1 + (i * 0.8) / (N - 1),
  phase: i / N,
  rotSpeed: 1 + (i % 3) * 0.7,
  sway: 0.03 + (i % 3) * 0.02,
  rFrac: 0.02 + (i % 3) * 0.005,
  colorIndex: i,
}));

type LeafSeed = (typeof LEAF_SEEDS)[number];

function leafFrame(seed: LeafSeed, t: number, size: number) {
  const tt = (t * 0.6 + seed.phase) % 1;
  const y = tt * size;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 3) * size * seed.sway;
  const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
  const rot = tt * Math.PI * seed.rotSpeed;
  const r = seed.rFrac * size;
  const dx = Math.cos(rot) * r * 0.3;
  const dy = Math.sin(rot) * r * 0.3;
  return { x, y, alpha, r, dx, dy };
}

function circle1Sampler(seed: LeafSeed): DotSampler {
  return (t, size) => {
    const { x, y, alpha, r, dx, dy } = leafFrame(seed, t, size);
    return { cx: x - dx, cy: y - dy, r, opacity: alpha * 0.7 };
  };
}

function circle2Sampler(seed: LeafSeed): DotSampler {
  return (t, size) => {
    const { x, y, alpha, r, dx, dy } = leafFrame(seed, t, size);
    return { cx: x + dx, cy: y + dy, r: r * 0.8, opacity: alpha * 0.7 };
  };
}

function veinSampler(seed: LeafSeed): LineSampler {
  return (t, size) => {
    const { x, y, alpha, dx, dy } = leafFrame(seed, t, size);
    return {
      x1: x - dx * 2,
      y1: y - dy * 2,
      x2: x + dx * 2,
      y2: y + dy * 2,
      opacity: alpha * 0.5,
      strokeWidth: 0.5,
    };
  };
}

const nodes = LEAF_SEEDS.flatMap((seed): DecorationNode[] => {
  const [cr, cg, cb] = COLORS[seed.colorIndex]!;
  const body = `rgb(${cr},${cg},${cb})`;
  const vein = `rgb(${cr - 20},${cg - 20},${cb - 10})`;
  return [
    { kind: 'dot', sample: circle1Sampler(seed), durationMs: LOOP_MS, color: body },
    { kind: 'dot', sample: circle2Sampler(seed), durationMs: LOOP_MS, color: body },
    { kind: 'line', sample: veinSampler(seed), durationMs: LOOP_MS, color: vein },
  ];
});

export const forestLeafFlair: DecorationSpec = { id: 'forestLeaf', nodes };
