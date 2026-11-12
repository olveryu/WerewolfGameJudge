/**
 * Blaze Trail: 3 flame arcs spin around the avatar, each a three-layer stroke with a bright head.
 * Each flame is rigid art spun about the tile centre by one layer.
 */
import { svgPath } from '@/scene/art';
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 3500;
const ARC_COUNT = 3;
const COLORS = [
  { outer: 'rgb(255,80,0)', mid: 'rgb(255,160,40)', core: 'rgb(255,240,180)' },
  { outer: 'rgb(255,100,20)', mid: 'rgb(255,180,60)', core: 'rgb(255,245,200)' },
  { outer: 'rgb(255,60,10)', mid: 'rgb(255,140,30)', core: 'rgb(255,235,170)' },
];

const ARC_SEEDS = Array.from({ length: ARC_COUNT }, (_, i) => ({
  phase: i / ARC_COUNT,
  span: 0.8 + (i % 2) * 0.3,
}));

function buildArcD(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + Math.cos(startAngle) * radius;
  const y1 = cy + Math.sin(startAngle) * radius;
  const x2 = cx + Math.cos(endAngle) * radius;
  const y2 = cy + Math.sin(endAngle) * radius;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

/** The whole flame spins once per loop. */
const arcSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const ARC_ARTS: readonly StaticArt[] = ARC_SEEDS.map((seed, i) => (context, size) => {
  const { outer, mid, core } = COLORS[i]!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;
  context
    .path(svgPath(buildArcD(cx, cy, r, 0, seed.span)))
    .stroke({ color: outer, width: size * 0.03, alpha: 0.25, cap: 'round' });
  context
    .path(svgPath(buildArcD(cx, cy, r, seed.span * 0.15, seed.span * 0.85)))
    .stroke({ color: mid, width: size * 0.015, alpha: 0.45, cap: 'round' });
  context
    .path(svgPath(buildArcD(cx, cy, r, seed.span * 0.3, seed.span * 0.7)))
    .stroke({ color: core, width: size * 0.006, alpha: 0.65, cap: 'round' });
  context
    .circle(cx + Math.cos(seed.span) * r, cy + Math.sin(seed.span) * r, size * 0.012)
    .fill({ color: core, alpha: 0.7 });
});

const nodes = ARC_SEEDS.map((seed, i): LayerNode => ({
  kind: 'layer',
  sample: arcSampler,
  box: (size) => ({ width: size, height: size }),
  art: ARC_ARTS[i]!,
  durationMs: LOOP_MS,
  phase: seed.phase,
}));

export const blazeTrailFlair: DecorationSpec = { id: 'blazeTrail', nodes };
