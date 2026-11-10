/** Eclipse Ring: a breathing corona of 3 concentric rings around the avatar edge, with sparks. */
import type { DecorationNode, DecorationSpec, DotSampler, RingSampler } from '@/scene/decoration';

const LOOP_MS = 4000;
const SPARK_COUNT = 5;

const CORONA_LAYERS = [
  { color: 'rgb(255,120,40)', rOff: 0.04, widthMul: 0.03, opMul: 0.15 },
  { color: 'rgb(255,180,80)', rOff: 0.02, widthMul: 0.015, opMul: 0.25 },
  { color: 'rgb(255,240,200)', rOff: 0, widthMul: 0.005, opMul: 0.4 },
] as const;

const SPARK_SEEDS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  angle: (i / SPARK_COUNT) * Math.PI * 2,
  phase: i / SPARK_COUNT,
}));

const CORONA_SAMPLERS: readonly RingSampler[] = CORONA_LAYERS.map((layer) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
  const r = size * (0.42 + layer.rOff) * pulse;
  return { cx, cy, r, opacity: layer.opMul * pulse, strokeWidth: size * layer.widthMul };
});

const SPARK_SAMPLERS: readonly DotSampler[] = SPARK_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
  const r = size * 0.46 * pulse;
  const angle = seed.angle + t * 0.5;
  const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.6);
  return {
    cx: cx + Math.cos(angle) * r,
    cy: cy + Math.sin(angle) * r,
    r: size * 0.008,
    opacity: alpha,
  };
});

const nodes: DecorationNode[] = [
  ...CORONA_LAYERS.map(
    (layer, i): DecorationNode => ({
      kind: 'ring',
      sample: CORONA_SAMPLERS[i]!,
      durationMs: LOOP_MS,
      color: layer.color,
    }),
  ),
  ...SPARK_SEEDS.map(
    (seed, i): DecorationNode => ({
      kind: 'dot',
      sample: SPARK_SAMPLERS[i]!,
      durationMs: LOOP_MS,
      phase: seed.phase,
      color: 'rgb(255,200,80)',
    }),
  ),
];

export const eclipseRingFlair: DecorationSpec = { id: 'eclipseRing', nodes };
