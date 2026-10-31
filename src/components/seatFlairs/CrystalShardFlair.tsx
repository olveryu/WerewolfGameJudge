/**
 * CrystalShardFlair — Crystal Shards
 *
 * 6 diamond-shaped crystal shards slowly rotate and float around the avatar, with faceted highlight lines.
 * Each shard keeps its axis-aligned shape while orbiting, so diamond and highlight are static SVGs
 * translated by their own LoopLayer (separate opacity envelopes); the vertex spark is a LoopDot.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

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
/** Layer box as a multiple of shard half-height; leaves room for the stroke. */
const BOX_FACTOR = 3;

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

export const CrystalShardFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SHARD_SEEDS.map((seed, i) => {
      const [cr, cg, cb] = COLORS[seed.ci]!;
      const hw = seed.shardW * size;
      const hh = seed.shardH * size;
      const highlightHh = seed.shardH * size * 0.6;
      const box = hh * BOX_FACTOR;
      const half = box / 2;
      const viewBox = `${-half} ${-half} ${box} ${box}`;
      return (
        <Fragment key={`shard-${seed.angleOff}`}>
          <LoopLayer
            sample={SHARD_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={box}
            height={box}
          >
            <Svg width={box} height={box} viewBox={viewBox}>
              <Path
                d={`M 0 ${-hh} L ${hw} 0 L 0 ${hh} L ${-hw} 0 Z`}
                stroke={`rgb(${cr},${cg},${cb})`}
                strokeWidth={size * 0.008}
                fill={`rgba(${cr},${cg},${cb},0.1)`}
              />
            </Svg>
          </LoopLayer>
          <LoopLayer
            sample={HIGHLIGHT_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={box}
            height={box}
          >
            <Svg width={box} height={box} viewBox={viewBox}>
              <Path
                d={`M 0 ${-highlightHh} L 0 ${highlightHh}`}
                stroke="rgb(255,255,255)"
                strokeWidth={size * 0.005}
                fill="none"
              />
            </Svg>
          </LoopLayer>
          <LoopDot
            sample={SPARK_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(255,255,255)"
          />
        </Fragment>
      );
    })}
  </View>
));
CrystalShardFlair.displayName = 'CrystalShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
