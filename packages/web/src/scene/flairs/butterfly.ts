/**
 * Butterflies: 6 butterflies fly around the periphery with flapping wings (two dots) and a body
 * dot. The seed phase offsets orbit angle and flap, not time, so samplers keep it.
 */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const N = 6;
const COLORS = [
  [180, 100, 220],
  [200, 120, 240],
  [160, 80, 200],
  [220, 140, 255],
  [190, 90, 230],
  [210, 130, 250],
] as const;

const BUTTERFLY_SEEDS = Array.from({ length: N }, (_, i) => ({
  phase: i / N,
  orbit: 0.28 + (i % 2) * 0.08,
  speed: 0.6 + i * 0.1,
}));

type ButterflySeed = (typeof BUTTERFLY_SEEDS)[number];

interface ButterflyPose {
  x: number;
  y: number;
  angle: number;
  wingFlap: number;
}

function butterflyPose(t: number, size: number, seed: ButterflySeed): ButterflyPose {
  const cx = size / 2;
  const cy = size / 2;
  const angle = (t * seed.speed + seed.phase) * Math.PI * 2;
  const dist = seed.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + seed.phase * 10));
  return { x, y, angle, wingFlap };
}

function wingSampler(seed: ButterflySeed, side: -1 | 1): DotSampler {
  return (t, size) => {
    const { x, y, angle, wingFlap } = butterflyPose(t, size, seed);
    const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
    const alpha = 0.4 + 0.4 * wingFlap;
    const bodyAngle = angle + Math.PI / 2;
    const wdx = Math.cos(bodyAngle) * wingR * 0.5;
    const wdy = Math.sin(bodyAngle) * wingR * 0.5;
    return { cx: x + side * wdx, cy: y + side * wdy, r: wingR, opacity: alpha };
  };
}

function bodySampler(seed: ButterflySeed): DotSampler {
  return (t, size) => {
    const { x, y, wingFlap } = butterflyPose(t, size, seed);
    const alpha = Math.min(1, 0.4 + 0.4 * wingFlap + 0.2);
    return { cx: x, cy: y, r: size * 0.005, opacity: alpha };
  };
}

const nodes = BUTTERFLY_SEEDS.flatMap((seed, i): DecorationNode[] => {
  const [cr, cg, cb] = COLORS[i]!;
  const wingColor = `rgb(${cr},${cg},${cb})`;
  return [
    { kind: 'dot', sample: wingSampler(seed, -1), durationMs: LOOP_MS, color: wingColor },
    { kind: 'dot', sample: wingSampler(seed, 1), durationMs: LOOP_MS, color: wingColor },
    {
      kind: 'dot',
      sample: bodySampler(seed),
      durationMs: LOOP_MS,
      color: `rgb(${cr - 40},${cg - 40},${cb - 40})`,
    },
  ];
});

export const butterflyFlair: DecorationSpec = { id: 'butterfly', nodes };
