/**
 * Jade Mist: 5 emerald tendrils rise from the bottom in S-curves with a bright tip. The rise is
 * a vertical scale of one static curve anchored at the tile bottom (layer `scaleY`).
 */
import { svgPath } from '@/scene/art';
import type {
  BoxSize,
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 5000;
const TENDRIL_COUNT = 5;
const GREENS = [
  [60, 180, 100],
  [80, 200, 120],
  [50, 160, 90],
  [70, 190, 110],
  [90, 210, 130],
] as const;
const STROKE_FRAC = 0.012;
/** Curve height at full rise, as a fraction of tile size. */
const RISE_FRAC = 0.9;

const TENDRIL_SEEDS = Array.from({ length: TENDRIL_COUNT }, (_, i) => ({
  xBase: 0.15 + (i * 0.7) / (TENDRIL_COUNT - 1),
  amplitude: 0.04 + (i % 3) * 0.025,
  phase: i / TENDRIL_COUNT,
  ci: i % GREENS.length,
}));

type TendrilSeed = (typeof TENDRIL_SEEDS)[number];

/** Layer box: wide enough for the sway plus round caps, tall enough for the full rise. */
function tendrilBox(seed: TendrilSeed, size: number): BoxSize {
  const amp = seed.amplitude * size;
  const strokeWidth = size * STROKE_FRAC;
  return { width: 2 * (amp + strokeWidth), height: size * RISE_FRAC + strokeWidth / 2 };
}

/** Static curve at full rise, in box space with the base at the box bottom edge. */
function tendrilPath(seed: TendrilSeed, size: number): string {
  const { width, height } = tendrilBox(seed, size);
  const bx = width / 2;
  const by = height;
  const midY1 = by - size * 0.35;
  const midY2 = by - size * 0.65;
  const topY = by - size * 0.9;
  const amp = seed.amplitude * size;
  return `M ${bx} ${by} C ${bx + amp} ${midY1} ${bx - amp * 0.7} ${midY2} ${bx + amp * 0.3} ${topY}`;
}

const TENDRIL_SAMPLERS: readonly LayerSampler[] = TENDRIL_SEEDS.map((seed) => (t, size) => {
  const rise = t;
  const bx = seed.xBase * size;
  const by = size;
  const { height } = tendrilBox(seed, size);
  const alpha = rise < 0.1 ? rise / 0.1 : rise > 0.8 ? (1 - rise) / 0.2 : 0.3;
  return {
    x: bx,
    y: by - (height / 2) * rise,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: rise,
    opacity: alpha,
  };
});

const TIP_SAMPLERS: readonly DotSampler[] = TENDRIL_SEEDS.map((seed) => (t, size) => {
  const rise = t;
  const bx = seed.xBase * size;
  const by = size;
  const topY = by - rise * size * 0.9;
  const amp = seed.amplitude * size;
  const alpha = rise > 0.3 && rise < 0.8 ? 0.5 : 0;
  return { cx: bx + amp * 0.3, cy: topY, r: size * 0.01, opacity: alpha };
});

const nodes = TENDRIL_SEEDS.flatMap((seed, i): DecorationNode[] => {
  const [cr, cg, cb] = GREENS[seed.ci]!;
  const tendrilArt: StaticArt = (context, size) => {
    context
      .path(svgPath(tendrilPath(seed, size)))
      .stroke({ color: `rgb(${cr},${cg},${cb})`, width: size * STROKE_FRAC, cap: 'round' });
  };
  return [
    {
      kind: 'layer',
      sample: TENDRIL_SAMPLERS[i]!,
      box: (size) => tendrilBox(seed, size),
      art: tendrilArt,
      durationMs: LOOP_MS,
      phase: seed.phase,
    },
    {
      kind: 'dot',
      sample: TIP_SAMPLERS[i]!,
      durationMs: LOOP_MS,
      phase: seed.phase,
      color: `rgb(${Math.min(255, cr + 80)},${Math.min(255, cg + 50)},${Math.min(255, cb + 80)})`,
    },
  ];
});

export const jadeMistFlair: DecorationSpec = { id: 'jadeMist', nodes };
