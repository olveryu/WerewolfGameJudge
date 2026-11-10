/** Obsidian Pulse: 4 dark diamonds at different angles breathe in and out from the centre. */
import { svgPath } from '@/scene/art';
import type { DecorationSpec, LayerNode, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 3500;
const SHAPE_COUNT = 4;
/** Radius at full breath, as a fraction of tile size. */
const R_MAX_FRAC = 0.45;

const SHAPE_SEEDS = Array.from({ length: SHAPE_COUNT }, (_, i) => ({
  rotation: (i / SHAPE_COUNT) * Math.PI * 2,
  phase: i / SHAPE_COUNT,
}));

type ShapeSeed = (typeof SHAPE_SEEDS)[number];

/** Static diamond at the maximum radius, centred on the tile centre in a tile-sized box. */
function diamondPath(seed: ShapeSeed, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * R_MAX_FRAC;
  const angle = seed.rotation;
  const top = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  const right = {
    x: cx + Math.cos(angle + Math.PI / 2) * r * 0.5,
    y: cy + Math.sin(angle + Math.PI / 2) * r * 0.5,
  };
  const bottom = {
    x: cx + Math.cos(angle + Math.PI) * r,
    y: cy + Math.sin(angle + Math.PI) * r,
  };
  const left = {
    x: cx + Math.cos(angle + Math.PI * 1.5) * r * 0.5,
    y: cy + Math.sin(angle + Math.PI * 1.5) * r * 0.5,
  };
  return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
}

const diamondSampler: LayerSampler = (t, size) => {
  const breathe = 0.5 + Math.sin(t * Math.PI * 2) * 0.5;
  const r = size * (0.15 + breathe * 0.3);
  const scale = r / (size * R_MAX_FRAC);
  const alpha = 0.1 + breathe * 0.15;
  return { x: size / 2, y: size / 2, rotateDeg: 0, scaleX: scale, scaleY: scale, opacity: alpha };
};

function diamondArt(seed: ShapeSeed): StaticArt {
  return (context, size) => {
    context
      .path(svgPath(diamondPath(seed, size)))
      .fill('rgb(40,30,60)')
      .stroke({ color: 'rgb(120,100,140)', width: size * 0.004, join: 'miter' });
  };
}

const nodes = SHAPE_SEEDS.map(
  (seed): LayerNode => ({
    kind: 'layer',
    sample: diamondSampler,
    box: (size) => ({ width: size, height: size }),
    art: diamondArt(seed),
    durationMs: LOOP_MS,
    phase: seed.phase,
  }),
);

export const obsidianPulseFlair: DecorationSpec = { id: 'obsidianPulse', nodes };
