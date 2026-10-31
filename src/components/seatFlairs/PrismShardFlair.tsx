/**
 * PrismShardFlair — Prism Shards
 *
 * 6 colorful triangular shards rotate and float at the periphery, colors shift over time, with top
 * highlight dots. Each shard is a rigid group (fill disc + outline + vertex sparkle) moved by one
 * LoopLayer; the 60° hue drift is a cross-fade between the loop's start and end colours.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 7000;
const SHARD_COUNT = 6;
const HUES = [0, 60, 120, 180, 240, 300] as const;
/** Hue travelled over one loop. */
const HUE_DRIFT = 60;
const SHARD_R_FRAC = 0.028;
/** Layer box as a multiple of shard radius; leaves room for the stroke. */
const BOX_FACTOR = 3;
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

/** Start-of-loop colour layer fades out as the end-of-loop colour layer fades in. */
const START_SAMPLERS: readonly LayerSampler[] = SHARD_SEEDS.map((seed) =>
  createShardSampler(seed, (t) => 1 - t),
);
const END_SAMPLERS: readonly LayerSampler[] = SHARD_SEEDS.map((seed) =>
  createShardSampler(seed, (t) => t),
);

/** Static shard artwork centred on the origin; `hue` picks the fill / outline colours. */
function ShardArt({ size, hue }: { size: number; hue: number }) {
  const shardR = size * SHARD_R_FRAC;
  const box = shardR * BOX_FACTOR;
  const half = box / 2;
  const p0 = { x: Math.cos(-Math.PI / 2) * shardR, y: Math.sin(-Math.PI / 2) * shardR };
  const p1 = {
    x: Math.cos(Math.PI * 0.3) * shardR * 0.7,
    y: Math.sin(Math.PI * 0.3) * shardR * 0.7,
  };
  const p2 = {
    x: Math.cos(Math.PI * 1.2) * shardR * 0.7,
    y: Math.sin(Math.PI * 1.2) * shardR * 0.7,
  };
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Circle r={shardR * 0.5} fill={hueToRgb(hue, 128, 80)} opacity={0.4} />
      <Path
        d={`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`}
        fill="none"
        stroke={hueToRgb(hue, 160, 60)}
        strokeWidth={0.8}
        opacity={0.7}
      />
      <Circle cx={p0.x} cy={p0.y} r={size * 0.006} fill={SPARKLE_COLOR} opacity={0.6} />
    </Svg>
  );
}

export const PrismShardFlair = memo<FlairProps>(({ size }) => {
  const box = size * SHARD_R_FRAC * BOX_FACTOR;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {SHARD_SEEDS.map((seed, i) => (
        <Fragment key={`shard-${seed.hue0}`}>
          <LoopLayer
            sample={START_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            width={box}
            height={box}
          >
            <ShardArt size={size} hue={seed.hue0} />
          </LoopLayer>
          <LoopLayer
            sample={END_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            width={box}
            height={box}
          >
            <ShardArt size={size} hue={seed.hue0 + HUE_DRIFT} />
          </LoopLayer>
        </Fragment>
      ))}
    </View>
  );
});
PrismShardFlair.displayName = 'PrismShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
