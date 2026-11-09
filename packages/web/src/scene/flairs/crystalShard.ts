/**
 * Crystal Shard: 6 diamond shards float around the avatar with faceted highlight lines. Each
 * shard keeps its axis-aligned shape while orbiting, so diamond and highlight are art moved by
 * their own layers (separate envelopes); the vertex spark is a dot.
 */
import { svgPath } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  DotSampler,
  LayerSampler,
  StaticArt,
} from '@/scene/decoration';

const LOOP_MS = 6000;
const SHARD_COUNT = 6;
const COLORS = [
  [180, 220, 255],
  [200, 180, 255],
  [160, 240, 240],
  [220, 200, 255],
  [180, 200, 240],
  [200, 240, 255],
] as const;

const SHARD_SEEDS = Array.from({ length: SHARD_COUNT }, (_, i) => ({
  orbitR: 0.42 + (i % 3) * 0.04,
  angleOff: (i / SHARD_COUNT) * Math.PI * 2,
  phase: i / SHARD_COUNT,
  shardH: 0.04 + (i % 2) * 0.015,
  shardW: 0.02 + (i % 3) * 0.005,
  ci: i % COLORS.length,
}));

type ShardSeed = (typeof SHARD_SEEDS)[number];

function shardCentre(t: number, size: number, seed: ShardSeed): { px: number; py: number } {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 + seed.angleOff;
  const px = cx + Math.cos(angle) * seed.orbitR * size;
  const py = cy + Math.sin(angle) * seed.orbitR * size;
  return { px, py };
}

const SHARD_SAMPLERS: readonly LayerSampler[] = SHARD_SEEDS.map((seed) => (t, size) => {
  const { px, py } = shardCentre(t, size, seed);
  const alpha = 0.3 + Math.sin(t * Math.PI * 4) * 0.15;
  return { x: px, y: py, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

const HIGHLIGHT_SAMPLERS: readonly LayerSampler[] = SHARD_SEEDS.map((seed) => (t, size) => {
  const { px, py } = shardCentre(t, size, seed);
  const alpha = 0.2 + Math.sin(t * Math.PI * 6) * 0.15;
  return { x: px, y: py, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

const SPARK_SAMPLERS: readonly DotSampler[] = SHARD_SEEDS.map((seed) => (t, size) => {
  const { px, py } = shardCentre(t, size, seed);
  const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.5);
  return { cx: px, cy: py - seed.shardH * size, r: size * 0.008, opacity: alpha };
});

const SHARD_ARTS: readonly StaticArt[] = SHARD_SEEDS.map((seed) => (context, size) => {
  const [cr, cg, cb] = COLORS[seed.ci]!;
  const hw = seed.shardW * size;
  const hh = seed.shardH * size;
  context
    .path(svgPath(`M 0 ${-hh} L ${hw} 0 L 0 ${hh} L ${-hw} 0 Z`))
    .fill(`rgba(${cr},${cg},${cb},0.1)`)
    .stroke({ color: `rgb(${cr},${cg},${cb})`, width: size * 0.008 });
});

const HIGHLIGHT_ARTS: readonly StaticArt[] = SHARD_SEEDS.map((seed) => (context, size) => {
  const highlightHh = seed.shardH * size * 0.6;
  context
    .path(svgPath(`M 0 ${-highlightHh} L 0 ${highlightHh}`))
    .stroke({ color: 'rgb(255,255,255)', width: size * 0.005 });
});

const nodes = SHARD_SEEDS.flatMap((seed, i): DecorationNode[] => [
  {
    kind: 'layer',
    sample: SHARD_SAMPLERS[i]!,
    art: SHARD_ARTS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'layer',
    sample: HIGHLIGHT_SAMPLERS[i]!,
    art: HIGHLIGHT_ARTS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
  },
  {
    kind: 'dot',
    sample: SPARK_SAMPLERS[i]!,
    durationMs: LOOP_MS,
    phase: seed.phase,
    color: 'rgb(255,255,255)',
  },
]);

export const crystalShardFlair: DecorationSpec = { id: 'crystalShard', nodes };
