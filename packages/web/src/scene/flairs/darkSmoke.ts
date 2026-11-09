/**
 * Dark Smoke: 5 dark-purple wisps rise from the bottom in S-shaped curves. The rise and fade
 * move a layer; the sideways sway bends the curve, drawn as cross-faded morph variants inside
 * the layer. The head puff is a dot.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  MorphArt,
  MorphSampler,
} from '@/scene/decoration';

const LOOP_MS = 5000;
const WISP_COUNT = 5;
/** Static curves per wisp; 8 across a 5 s loop keeps each cross-fade well under a second. */
const WISP_VARIANTS = 8;
/** Vertical travel per loop as a fraction of the tile. */
const RISE_FRAC = 0.8;
/** Gap between the wisp base and the box bottom, as in the original. */
const CAP_PAD_FRAC = 0.05;

const WISP_SEEDS = Array.from({ length: WISP_COUNT }, (_, i) => ({
  xBase: 0.2 + (i * 0.6) / (WISP_COUNT - 1),
  phase: i / WISP_COUNT,
  drift: 0.05 + (i % 3) * 0.02,
  width: 0.03 + (i % 2) * 0.015,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

/** Wisp curve at loop progress `t`, drawn with its base `CAP_PAD_FRAC` above the box bottom. */
function wispPath(t: number, size: number, seed: WispSeed): string {
  const base = size * seed.xBase;
  const y0 = size - size * CAP_PAD_FRAC;
  const y1 = y0 - size * 0.15;
  const y2 = y1 - size * 0.15;
  const y3 = y2 - size * 0.15;
  const dx = seed.drift * size * Math.sin(t * Math.PI * 3);
  return `M ${base} ${y0} Q ${base + dx} ${y1} ${base - dx * 0.5} ${y2} Q ${base + dx * 0.3} ${y3 + size * 0.05} ${base} ${y3}`;
}

/** Rise and fade of the wisp box; the in-box base lands on `y0 = size × (1 − 0.8 t)`. */
const riseSampler: LayerSampler = (t, size) => {
  const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
  return {
    x: size / 2,
    y: size / 2 - t * RISE_FRAC * size + size * CAP_PAD_FRAC,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: alpha * 0.25,
  };
};

/** The fade lives on the enclosing layer, so the morph itself is fully opaque. */
const opaqueSampler: MorphSampler = () => ({ opacity: 1 });

const HEAD_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const base = size * seed.xBase;
  const y = size * (1 - t * 0.8) - size * 0.45;
  const dx = seed.drift * size * Math.sin(t * Math.PI * 3) * 0.3;
  const alpha = t < 0.2 ? 0 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
  return { cx: base + dx, cy: y, r: seed.width * size * 0.8, opacity: alpha };
});

const WISP_ARTS: readonly MorphArt[] = WISP_SEEDS.map((seed) => (context, k, size) => {
  context
    .path(svgPath(wispPath(k / WISP_VARIANTS, size, seed)))
    .stroke({ color: 'rgb(80,60,100)', width: seed.width * size, cap: 'round' });
});

const nodes = WISP_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'layer',
    sample: riseSampler,
    box: (size) => ({ width: size, height: size }),
    durationMs: LOOP_MS,
    phase: seed.phase,
    children: [
      {
        kind: 'morph',
        sample: opaqueSampler,
        durationMs: LOOP_MS,
        phase: seed.phase,
        variantCount: WISP_VARIANTS,
        mode: 'crossfade',
        art: WISP_ARTS[i]!,
      },
    ],
  },
  {
    kind: 'dot',
    sample: HEAD_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(60,40,80)',
  },
]);

export const darkSmokeFlair: DecorationSpec = { id: 'darkSmoke', nodes };
