/**
 * MoonBeamFlair — 月光束
 *
 * 5 道竖直月光柱从上方缓慢扫过头像区域，带光晕圆。
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

const BEAM_COUNT = 5;

interface BeamSeed {
  xPhase: number;
  width: number;
  phase: number;
}

const BeamParticle = memo<{ seed: BeamSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const lineProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xPhase * size + Math.sin(t * Math.PI * 2) * size * 0.15;
      const alpha = 0.08 + Math.sin(t * Math.PI * 2) * 0.06;
      return {
        x1: x,
        y1: 0,
        x2: x + size * 0.03,
        y2: size,
        opacity: alpha,
        strokeWidth: seed.width * size,
      } as Record<string, number>;
    });

    const haloProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = seed.xPhase * size + Math.sin(t * Math.PI * 2) * size * 0.15;
      const y = size * 0.15 + t * size * 0.1;
      const alpha = 0.12 + Math.sin(t * Math.PI * 4) * 0.08;
      return { cx: x, cy: y, r: size * 0.04, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedLine animatedProps={lineProps} stroke="rgb(200,210,240)" strokeLinecap="round" />
        <AnimatedCircle animatedProps={haloProps} fill="rgb(220,230,255)" />
      </>
    );
  },
);
BeamParticle.displayName = 'BeamParticle';

export const MoonBeamFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: BEAM_COUNT }, (_, i) => ({
        xPhase: 0.15 + (i * 0.7) / (BEAM_COUNT - 1),
        width: 0.03 + (i % 2) * 0.015,
        phase: i / BEAM_COUNT,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <BeamParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
MoonBeamFlair.displayName = 'MoonBeamFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
