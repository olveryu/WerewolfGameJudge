/**
 * Thorn Vine: 4 thorny vines grow from the corners toward the centre. The growing vine is the
 * full curve scaled about its start corner, so static art centred on that corner is scaled by
 * a layer.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 5000;

const VINE_SEEDS = [
  { startX: 0, startY: 0, ctrlX: 0.3, ctrlY: 0.2, endX: 0.45, endY: 0.45, phase: 0 },
  { startX: 1, startY: 0, ctrlX: 0.7, ctrlY: 0.25, endX: 0.55, endY: 0.45, phase: 0.25 },
  { startX: 0, startY: 1, ctrlX: 0.25, ctrlY: 0.7, endX: 0.45, endY: 0.55, phase: 0.5 },
  { startX: 1, startY: 1, ctrlX: 0.75, ctrlY: 0.75, endX: 0.55, endY: 0.55, phase: 0.75 },
] as const;

type VineSeed = (typeof VINE_SEEDS)[number];

/** Fully grown vine in tile pixel space. */
function vinePath(seed: VineSeed, size: number): string {
  const sx = seed.startX * size;
  const sy = seed.startY * size;
  const mx = seed.ctrlX * size;
  const my = seed.ctrlY * size;
  const ex = seed.endX * size;
  const ey = seed.endY * size;
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
}

function vineSampler(seed: VineSeed): LayerSampler {
  return (t, size) => {
    const growFrac = Math.min(t * 2, 1);
    const alpha = t > 0.7 ? (1 - t) / 0.3 : 0.4;
    return {
      x: seed.startX * size,
      y: seed.startY * size,
      rotateDeg: 0,
      scaleX: growFrac,
      scaleY: growFrac,
      opacity: alpha,
    };
  };
}

function thornSampler(seed: VineSeed): DotSampler {
  return (t, size) => {
    const growFrac = Math.min(t * 2, 1);
    const midX = seed.startX * size + (seed.ctrlX * size - seed.startX * size) * growFrac * 0.5;
    const midY = seed.startY * size + (seed.ctrlY * size - seed.startY * size) * growFrac * 0.5;
    const alpha = growFrac > 0.3 ? (t > 0.7 ? (1 - t) / 0.3 : 0.5) : 0;
    return { cx: midX, cy: midY - size * 0.02, r: size * 0.008, opacity: alpha };
  };
}

function tipSampler(seed: VineSeed): DotSampler {
  return (t, size) => {
    const growFrac = Math.min(t * 2, 1);
    const ex = seed.startX * size + (seed.endX * size - seed.startX * size) * growFrac;
    const ey = seed.startY * size + (seed.endY * size - seed.startY * size) * growFrac;
    const alpha = growFrac > 0.5 ? (t > 0.7 ? (1 - t) / 0.3 : 0.6) : 0;
    return { cx: ex, cy: ey, r: size * 0.01, opacity: alpha };
  };
}

/** Vine drawn with its start corner on the origin. */
function vineArt(seed: VineSeed): StaticArt {
  return (context, size) => {
    context.translate(-seed.startX * size, -seed.startY * size);
    context
      .path(svgPath(vinePath(seed, size)))
      .stroke({ color: 'rgb(60,80,40)', width: size * 0.012, cap: 'round' });
  };
}

const nodes = VINE_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'layer',
    sample: vineSampler(seed),
    art: vineArt(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'dot',
    sample: thornSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(100,60,30)',
  },
  {
    kind: 'dot',
    sample: tipSampler(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(80,100,50)',
  },
]);

export const thornVineFlair: DecorationSpec = { id: 'thornVine', nodes };
