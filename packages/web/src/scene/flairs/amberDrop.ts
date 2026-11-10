/**
 * Amber Drop: 5 amber teardrops sway slowly down in a pendulum arc, each with a glossy glint.
 * The teardrop is rigid art moved by a layer; the glint is a dot.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 4500;
const DROP_COUNT = 5;

const DROP_SEEDS = Array.from({ length: DROP_COUNT }, (_, i) => ({
  xAnchor: 0.15 + (i * 0.7) / (DROP_COUNT - 1),
  swingAmp: 0.03 + (i % 3) * 0.015,
  phase: i / DROP_COUNT,
  rFrac: 0.018 + (i % 2) * 0.008,
}));

type DropSeed = (typeof DROP_SEEDS)[number];

/** Teardrop centred on the origin (`-1.5r … 1.5r`): top narrow, bottom round. */
function dropPath(r: number): string {
  const top = -r * 1.5;
  const mid = r * 0.5;
  return `M 0 ${top} Q ${-r} ${top + r} ${-r} ${mid} A ${r} ${r} 0 1 0 ${r} ${mid} Q ${r} ${top + r} 0 ${top} Z`;
}

function dropCentre(t: number, size: number, seed: DropSeed): { cx: number; y: number; r: number } {
  const y = t * size;
  const swing = Math.sin(t * Math.PI * 3) * seed.swingAmp * size;
  const cx = seed.xAnchor * size + swing;
  const r = seed.rFrac * size;
  return { cx, y, r };
}

const DROP_SAMPLERS: readonly LayerSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const { cx, y, r } = dropCentre(t, size, seed);
  const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.5;
  return { x: cx, y: y - r * 0.5, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

const GLINT_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const { cx, y, r } = dropCentre(t, size, seed);
  return {
    cx: cx - r * 0.3,
    cy: y - r * 0.3,
    r: r * 0.25,
    opacity: t > 0.1 && t < 0.8 ? 0.6 : 0,
  };
});

const DROP_ARTS: readonly StaticArt[] = DROP_SEEDS.map((seed) => (context, size) => {
  context
    .path(svgPath(dropPath(seed.rFrac * size)))
    .fill('rgb(200,150,40)')
    .stroke({ color: 'rgb(220,170,60)', width: size * 0.003 });
});

const nodes = DROP_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'layer',
    sample: DROP_SAMPLERS[i]!,
    art: DROP_ARTS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'dot',
    sample: GLINT_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(255,230,150)',
  },
]);

export const amberDropFlair: DecorationSpec = { id: 'amberDrop', nodes };
