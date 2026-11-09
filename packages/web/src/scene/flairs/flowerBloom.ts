/** Flower Bloom: 5 small flowers bloom in turn around the perimeter, 5 petal dots and a centre. */
import type { DecorationNode, DecorationSpec, DotSampler } from '@/scene/decoration';

const LOOP_MS = 6000;
const COLORS = [
  'rgb(255,130,160)',
  'rgb(255,150,180)',
  'rgb(240,120,170)',
  'rgb(255,160,140)',
  'rgb(250,140,190)',
] as const;

const FLOWER_INDICES = [0, 1, 2, 3, 4] as const;
const PETAL_INDICES = [0, 1, 2, 3, 4] as const;

function flowerFrame(f: number, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const dist = size * 0.32;
  const baseAngle = (f / 5) * Math.PI * 2;
  const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
  const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
  const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
  const petalR = size * 0.015 * bloom;
  return { fx, fy, bloom, petalR };
}

function createPetalSampler(f: number, p: number): DotSampler {
  return (t, size) => {
    const { fx, fy, bloom, petalR } = flowerFrame(f, t, size);
    const pa = (p / 5) * Math.PI * 2 + t * Math.PI;
    return {
      cx: fx + Math.cos(pa) * petalR * 1.2,
      cy: fy + Math.sin(pa) * petalR * 1.2,
      r: petalR * 0.7,
      opacity: bloom * 0.5,
    };
  };
}

function createCenterSampler(f: number): DotSampler {
  return (t, size) => {
    const { fx, fy, bloom, petalR } = flowerFrame(f, t, size);
    return { cx: fx, cy: fy, r: petalR * 0.4, opacity: bloom * 0.8 };
  };
}

const nodes = FLOWER_INDICES.flatMap((f): DecorationNode[] => [
  ...PETAL_INDICES.map(
    (p): DecorationNode => ({
      kind: 'dot',
      sample: createPetalSampler(f, p),
      durationMs: LOOP_MS,
      color: COLORS[f],
    }),
  ),
  {
    kind: 'dot',
    sample: createCenterSampler(f),
    durationMs: LOOP_MS,
    color: 'rgb(255,230,150)',
  },
]);

export const flowerBloomFlair: DecorationSpec = { id: 'flowerBloom', nodes };
