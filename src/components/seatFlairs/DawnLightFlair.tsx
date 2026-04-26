/**
 * DawnLightFlair — 曙光微照
 *
 * 4 道水平光带从底部向上缓慢扫过，金色渐变色调，带微光粒子。
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
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const BAND_COUNT = 4;

interface BandSeed {
  phase: number;
  width: number;
  xOff: number;
}

const BandParticle = memo<{ seed: BandSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const lineProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = size * (1 - t);
      const alpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 0.12;
      return {
        x1: seed.xOff * size,
        y1: y,
        x2: size - seed.xOff * size,
        y2: y,
        opacity: alpha,
        strokeWidth: seed.width * size,
      } as Record<string, number>;
    });

    const glintProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = size * (1 - t);
      const x = size * 0.3 + Math.sin(t * Math.PI * 4) * size * 0.2;
      const alpha = t > 0.3 && t < 0.7 ? 0.5 : 0;
      return { cx: x, cy: y, r: size * 0.008, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={lineProps} stroke="rgb(255,200,100)" strokeLinecap="round" />
        <AnimatedCircle animatedProps={glintProps} fill="rgb(255,240,200)" />
      </>
    );
  },
);
BandParticle.displayName = 'BandParticle';

export const DawnLightFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: BAND_COUNT }, (_, i) => ({
        phase: i / BAND_COUNT,
        width: 0.04 + (i % 2) * 0.02,
        xOff: 0.05 + (i % 3) * 0.03,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <BandParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
DawnLightFlair.displayName = 'DawnLightFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
