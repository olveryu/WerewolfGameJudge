/**
 * Prism Shard: 6 spinning prism shards drift around the avatar while their hue shifts. The hue
 * drift is a cross-fade between a start-colour and an end-colour copy of each shard.
 */
import { svgPath } from '@/scene/art';
import type { DecorationNode, DecorationSpec, LayerSampler, StaticArt } from '@/scene/decoration';

const LOOP_MS = 7000;
const SHARD_COUNT = 6;
const HUES = [0, 60, 120, 180, 240, 300] as const;
/** Hue travelled over one loop. */
const HUE_DRIFT = 60;
const SHARD_R_FRAC = 0.028;
const SPARKLE_COLOR = 'rgb(240,240,255)';

const SHARD_SEEDS = Array.from({ length: SHARD_COUNT }, (_, i) => ({
  angle0: (i / SHARD_COUNT) * Math.PI * 2 + i * 0.5,
  dist: 0.36 + (i % 3) * 0.05,
  phase: i / SHARD_COUNT,
  rotSpeed: 1.5 + (i % 3) * 0.5,
  hue0: HUES[i]!,
}));

type ShardSeed = (typeof SHARD_SEEDS)[number];

function hueToRgb(hue: number, base: number, swing: number): string {
  const r = base + Math.round(Math.cos((hue * Math.PI) / 180) * swing);
  const g = base + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * swing);
  const b = base + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * swing);
  return `rgb(${r},${g},${b})`;
}

function shardPulse(t: number, seed: ShardSeed): number {
  return 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + seed.phase * 5) * Math.PI));
}

function createShardSampler(seed: ShardSeed, colorWeight: (t: number) => number): LayerSampler {
  return (t, size) => {
    const angle = seed.angle0 + Math.sin((t + seed.phase) * Math.PI * 1.2) * 0.5;
    const dist = seed.dist * size + Math.cos(t * Math.PI * 2 + seed.phase * 4) * size * 0.03;
    return {
      x: size / 2 + Math.cos(angle) * dist,
      y: size / 2 + Math.sin(angle) * dist,
      rotateDeg: t * 180 * seed.rotSpeed,
      scaleX: 1,
      scaleY: 1,
      opacity: shardPulse(t, seed) * colorWeight(t),
    };
  };
}

/** Shard centred on the origin; `hue` picks the fill and outline colours. */
function shardArt(hue: number): StaticArt {
  return (context, size) => {
    const shardR = size * SHARD_R_FRAC;
    const p0 = { x: Math.cos(-Math.PI / 2) * shardR, y: Math.sin(-Math.PI / 2) * shardR };
    const p1 = {
      x: Math.cos(Math.PI * 0.3) * shardR * 0.7,
      y: Math.sin(Math.PI * 0.3) * shardR * 0.7,
    };
    const p2 = {
      x: Math.cos(Math.PI * 1.2) * shardR * 0.7,
      y: Math.sin(Math.PI * 1.2) * shardR * 0.7,
    };
    context.circle(0, 0, shardR * 0.5).fill({ color: hueToRgb(hue, 128, 80), alpha: 0.4 });
    context
      .path(svgPath(`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`))
      .stroke({ color: hueToRgb(hue, 160, 60), width: 0.8, alpha: 0.7 });
    context.circle(p0.x, p0.y, size * 0.006).fill({ color: SPARKLE_COLOR, alpha: 0.6 });
  };
}

/** The start-of-loop colour fades out as the end-of-loop colour fades in. */
const nodes = SHARD_SEEDS.flatMap((seed): DecorationNode[] => [
  {
    kind: 'layer',
    sample: createShardSampler(seed, (t) => 1 - t),
    art: shardArt(seed.hue0),
    durationMs: LOOP_MS,
  },
  {
    kind: 'layer',
    sample: createShardSampler(seed, (t) => t),
    art: shardArt(seed.hue0 + HUE_DRIFT),
    durationMs: LOOP_MS,
  },
]);

export const prismShardFlair: DecorationSpec = { id: 'prismShard', nodes };
