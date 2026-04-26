/**
 * MirageHeatFlair — 海市蜃楼
 *
 * 6 道水平波浪线上下起伏，模拟热浪扭曲效果，不同高度/振幅/频率。
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
import { AnimatedPath } from './svgAnimatedPrimitives';

const WAVE_COUNT = 6;

interface WaveSeed {
  yFrac: number;
  amplitude: number;
  freq: number;
  phase: number;
}

const HeatWave = memo<{ seed: WaveSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const baseY = seed.yFrac * size;
      const amp = seed.amplitude * size;
      const segments = 6;
      let d = `M 0 ${baseY}`;
      for (let i = 1; i <= segments; i++) {
        const sx = (i / segments) * size;
        const sy =
          baseY + Math.sin(t * Math.PI * 2 * seed.freq + (i / segments) * Math.PI * 4) * amp;
        const cpx = ((i - 0.5) / segments) * size;
        const cpy =
          baseY +
          Math.sin(t * Math.PI * 2 * seed.freq + ((i - 0.5) / segments) * Math.PI * 4) * amp * 1.2;
        d += ` Q ${cpx} ${cpy} ${sx} ${sy}`;
      }
      const shimmer = 0.06 + Math.sin(t * Math.PI * 2) * 0.04;
      return { d, opacity: shimmer, strokeWidth: size * 0.008 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    return (
      <AnimatedPath
        animatedProps={props}
        stroke="rgb(200,180,140)"
        fill="none"
        strokeLinecap="round"
      />
    );
  },
);
HeatWave.displayName = 'HeatWave';

export const MirageHeatFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: WAVE_COUNT }, (_, i) => ({
        yFrac: 0.15 + (i * 0.7) / (WAVE_COUNT - 1),
        amplitude: 0.01 + (i % 3) * 0.005,
        freq: 1 + (i % 2) * 0.5,
        phase: i / WAVE_COUNT,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <HeatWave key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
MirageHeatFlair.displayName = 'MirageHeatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
