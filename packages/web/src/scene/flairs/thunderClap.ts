/**
 * Thunder Clap: one large bolt strikes top to bottom in three layers (halo, mid, core) with 4
 * scattered sparks; quick flash, afterglow, dark, repeat.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  PathArt,
  PathSampler,
} from '@/scene/decoration';

const LOOP_MS = 3000;

const BOLT_LAYERS = [
  { color: 'rgb(80,140,255)', widthMul: 0.04, opacityMul: 0.3 },
  { color: 'rgb(160,200,255)', widthMul: 0.02, opacityMul: 0.6 },
  { color: 'rgb(240,245,255)', widthMul: 0.008, opacityMul: 0.9 },
] as const;

const SPARK_SEEDS = [
  { dx: -0.15, dy: -0.1 },
  { dx: 0.12, dy: -0.08 },
  { dx: -0.1, dy: 0.12 },
  { dx: 0.14, dy: 0.1 },
] as const;

function boltPath(size: number): string {
  const cx = size * 0.5;
  return `M ${cx} 0 L ${cx - size * 0.08} ${size * 0.25} L ${cx + size * 0.05} ${size * 0.35} L ${cx - size * 0.1} ${size * 0.55} L ${cx + size * 0.06} ${size * 0.7} L ${cx - size * 0.04} ${size}`;
}

const BOLT_SAMPLERS: readonly PathSampler[] = BOLT_LAYERS.map((layer) => (t, size) => {
  const flash =
    t < 0.1
      ? t / 0.1
      : t < 0.2
        ? 1 - ((t - 0.1) / 0.1) * 0.5
        : t < 0.3
          ? 0.5 - ((t - 0.2) / 0.1) * 0.5
          : 0;
  return { opacity: flash * layer.opacityMul, strokeWidth: size * layer.widthMul };
});

const BOLT_ARTS: readonly PathArt[] = BOLT_LAYERS.map((layer) => (context, strokeWidth, size) => {
  context
    .path(svgPath(boltPath(size)))
    .stroke({ color: layer.color, width: strokeWidth, cap: 'round', join: 'round' });
});

const SPARK_SAMPLERS: readonly DotSampler[] = SPARK_SEEDS.map((seed) => (t, size) => {
  const flash = t < 0.1 ? t / 0.1 : t < 0.25 ? 1 - (t - 0.1) / 0.15 : 0;
  const cx = size * 0.5 + seed.dx * size * flash;
  const cy = size * 0.5 + seed.dy * size * flash;
  return { cx, cy, r: size * 0.01 * flash, opacity: flash * 0.6 };
});

const nodes: DecorationNode[] = [
  ...BOLT_LAYERS.map((_, i): DecorationNode => ({
    kind: 'path',
    sample: BOLT_SAMPLERS[i]!,
    art: BOLT_ARTS[i]!,
    durationMs: LOOP_MS,
  })),
  ...SPARK_SAMPLERS.map((sample): DecorationNode => ({
    kind: 'dot',
    sample,
    durationMs: LOOP_MS,
    color: 'rgb(255,255,255)',
  })),
];

export const thunderClapFlair: DecorationSpec = { id: 'thunderClap', nodes };
