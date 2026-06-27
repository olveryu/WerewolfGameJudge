/**
 * CrystalShardFlair — Crystal Shards
 *
 * 6 diamond-shaped crystal shards slowly rotate and float around the avatar, with faceted highlight lines.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const SHARD_COUNT = 6;
const COLORS = [
  [180, 220, 255],
  [200, 180, 255],
  [160, 240, 240],
  [220, 200, 255],
  [180, 200, 240],
  [200, 240, 255],
] as const;

interface ShardSeed {
  orbitR: number;
  angleOff: number;
  phase: number;
  shardH: number;
  shardW: number;
  ci: number;
}

const ShardParticle = memo<{ seed: ShardSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci]!;
    const cx = size / 2;
    const cy = size / 2;

    const pathProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 + seed.angleOff;
      const px = cx + Math.cos(angle) * seed.orbitR * size;
      const py = cy + Math.sin(angle) * seed.orbitR * size;
      const hw = seed.shardW * size;
      const hh = seed.shardH * size;
      const d = `M ${px} ${py - hh} L ${px + hw} ${py} L ${px} ${py + hh} L ${px - hw} ${py} Z`;
      const alpha = 0.3 + Math.sin(t * Math.PI * 4) * 0.15;
      return { d, opacity: alpha, strokeWidth: size * 0.008 };
    });

    const highlightProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 + seed.angleOff;
      const px = cx + Math.cos(angle) * seed.orbitR * size;
      const py = cy + Math.sin(angle) * seed.orbitR * size;
      const hh = seed.shardH * size * 0.6;
      const d = `M ${px} ${py - hh} L ${px} ${py + hh}`;
      const alpha = 0.2 + Math.sin(t * Math.PI * 6) * 0.15;
      return { d, opacity: alpha, strokeWidth: size * 0.005 };
    });

    const sparkProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 + seed.angleOff;
      const px = cx + Math.cos(angle) * seed.orbitR * size;
      const py = cy + Math.sin(angle) * seed.orbitR * size - seed.shardH * size;
      const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.5);
      return { cx: px, cy: py, r: size * 0.008, opacity: alpha };
    });

    return (
      <>
        <AnimatedPath
          animatedProps={pathProps}
          stroke={`rgb(${cr},${cg},${cb})`}
          fill={`rgba(${cr},${cg},${cb},0.1)`}
        />
        <AnimatedPath animatedProps={highlightProps} stroke="rgb(255,255,255)" fill="none" />
        <AnimatedCircle animatedProps={sparkProps} fill="rgb(255,255,255)" />
      </>
    );
  },
);
ShardParticle.displayName = 'ShardParticle';

export const CrystalShardFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(6000);

  const seeds = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, i) => ({
        orbitR: 0.42 + (i % 3) * 0.04,
        angleOff: (i / SHARD_COUNT) * Math.PI * 2,
        phase: i / SHARD_COUNT,
        shardH: 0.04 + (i % 2) * 0.015,
        shardW: 0.02 + (i % 3) * 0.005,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <ShardParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
CrystalShardFlair.displayName = 'CrystalShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
