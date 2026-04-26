/**
 * EclipseRingFlair — 日蚀光环
 *
 * 日蚀光环脉动：内暗外亮的环形光晕在头像边缘呼吸，
 * 3 层同心弧(不同厚度/色调) + 边缘火星。
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
import { AnimatedCircle } from './svgAnimatedPrimitives';

const SPARK_COUNT = 5;

interface SparkSeed {
  angle: number;
  phase: number;
}

const CoronaLayer = memo<{
  size: number;
  progress: { value: number };
  color: string;
  rOff: number;
  widthMul: number;
  opMul: number;
}>(({ size, progress, color, rOff, widthMul, opMul }) => {
  const cx = size / 2;
  const cy = size / 2;
  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
    const r = size * (0.42 + rOff) * pulse;
    return { cx, cy, r, opacity: opMul * pulse, strokeWidth: size * widthMul } as Record<
      string,
      number
    >;
  });
  return <AnimatedCircle animatedProps={props} fill="none" stroke={color} />;
});
CoronaLayer.displayName = 'CoronaLayer';

const SparkParticle = memo<{ seed: SparkSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
      const r = size * 0.46 * pulse;
      const angle = seed.angle + t * 0.5;
      const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.6);
      return {
        cx: cx + Math.cos(angle) * r,
        cy: cy + Math.sin(angle) * r,
        r: size * 0.008,
        opacity: alpha,
      } as Record<string, number>;
    });
    return <AnimatedCircle animatedProps={props} fill="rgb(255,200,80)" />;
  },
);
SparkParticle.displayName = 'SparkParticle';

export const EclipseRingFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => ({
        angle: (i / SPARK_COUNT) * Math.PI * 2,
        phase: i / SPARK_COUNT,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <CoronaLayer
          size={size}
          progress={progress}
          color="rgb(255,120,40)"
          rOff={0.04}
          widthMul={0.03}
          opMul={0.15}
        />
        <CoronaLayer
          size={size}
          progress={progress}
          color="rgb(255,180,80)"
          rOff={0.02}
          widthMul={0.015}
          opMul={0.25}
        />
        <CoronaLayer
          size={size}
          progress={progress}
          color="rgb(255,240,200)"
          rOff={0}
          widthMul={0.005}
          opMul={0.4}
        />
        {sparks.map((s, i) => (
          <SparkParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
EclipseRingFlair.displayName = 'EclipseRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
