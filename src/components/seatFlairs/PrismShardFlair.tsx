/**
 * PrismShardFlair — 棱镜碎片
 *
 * 6 块彩色三角碎片在外围旋转漂浮，颜色随时间偏移，带顶部高光点。
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const N = 6;
const HUES = [0, 60, 120, 180, 240, 300] as const;

interface ShardSeed {
  angle0: number;
  dist: number;
  phase: number;
  rotSpeed: number;
}

const PrismParticle = memo<{
  seed: ShardSeed;
  hue0: number;
  size: number;
  progress: { value: number };
}>(({ seed, hue0, size, progress }) => {
  const cx0 = size / 2;
  const cy0 = size / 2;
  const shardR = size * 0.028;

  const fillProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const angle = seed.angle0 + Math.sin((t + seed.phase) * Math.PI * 1.2) * 0.5;
    const dist = seed.dist * size + Math.cos(t * Math.PI * 2 + seed.phase * 4) * size * 0.03;
    const x = cx0 + Math.cos(angle) * dist;
    const y = cy0 + Math.sin(angle) * dist;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + seed.phase * 5) * Math.PI));
    const hue = hue0 + t * 60;
    const rc = 128 + Math.round(Math.cos((hue * Math.PI) / 180) * 80);
    const gc = 128 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 80);
    const bc = 128 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 80);
    return {
      cx: x,
      cy: y,
      r: shardR * 0.5,
      opacity: pulse * 0.4,
      fill: `rgb(${rc},${gc},${bc})`,
    } as Record<string, number | string>;
  });

  const outlineProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const angle = seed.angle0 + Math.sin((t + seed.phase) * Math.PI * 1.2) * 0.5;
    const dist = seed.dist * size + Math.cos(t * Math.PI * 2 + seed.phase * 4) * size * 0.03;
    const x = cx0 + Math.cos(angle) * dist;
    const y = cy0 + Math.sin(angle) * dist;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + seed.phase * 5) * Math.PI));
    const rot = t * Math.PI * seed.rotSpeed;
    const p0x = x + Math.cos(rot - Math.PI / 2) * shardR;
    const p0y = y + Math.sin(rot - Math.PI / 2) * shardR;
    const p1x = x + Math.cos(rot + Math.PI * 0.3) * shardR * 0.7;
    const p1y = y + Math.sin(rot + Math.PI * 0.3) * shardR * 0.7;
    const p2x = x + Math.cos(rot + Math.PI * 1.2) * shardR * 0.7;
    const p2y = y + Math.sin(rot + Math.PI * 1.2) * shardR * 0.7;
    const hue = hue0 + t * 60;
    const brc = 160 + Math.round(Math.cos((hue * Math.PI) / 180) * 60);
    const bgc = 160 + Math.round(Math.cos(((hue - 120) * Math.PI) / 180) * 60);
    const bbc = 160 + Math.round(Math.cos(((hue - 240) * Math.PI) / 180) * 60);
    return {
      d: `M ${p0x} ${p0y} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`,
      opacity: pulse * 0.7,
      strokeWidth: 0.8,
      stroke: `rgb(${brc},${bgc},${bbc})`,
    } as Record<string, number | string>;
  });

  const sparkleProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const angle = seed.angle0 + Math.sin((t + seed.phase) * Math.PI * 1.2) * 0.5;
    const dist = seed.dist * size + Math.cos(t * Math.PI * 2 + seed.phase * 4) * size * 0.03;
    const x = cx0 + Math.cos(angle) * dist;
    const y = cy0 + Math.sin(angle) * dist;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin((t * 2 + seed.phase * 5) * Math.PI));
    const rot = t * Math.PI * seed.rotSpeed;
    const p0x = x + Math.cos(rot - Math.PI / 2) * shardR;
    const p0y = y + Math.sin(rot - Math.PI / 2) * shardR;
    return { cx: p0x, cy: p0y, r: size * 0.006, opacity: pulse * 0.6 } as Record<string, number>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={fillProps} />
      <AnimatedPath animatedProps={outlineProps} fill="none" />
      <AnimatedCircle animatedProps={sparkleProps} fill="rgb(240,240,255)" />
    </>
  );
});
PrismParticle.displayName = 'PrismParticle';

export const PrismShardFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2 + i * 0.5,
        dist: 0.36 + (i % 3) * 0.05,
        phase: i / N,
        rotSpeed: 1.5 + (i % 3) * 0.5,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <PrismParticle key={i} seed={s} hue0={HUES[i]} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
PrismShardFlair.displayName = 'PrismShardFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
