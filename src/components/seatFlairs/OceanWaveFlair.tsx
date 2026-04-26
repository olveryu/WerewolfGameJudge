/**
 * OceanWaveFlair — 海浪涌动
 *
 * 3 道水平正弦波纹从底部向上涌动，不同相位/振幅，带波峰水花粒子。
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

const WAVE_COUNT = 3;

interface WaveSeed {
  yBase: number;
  amplitude: number;
  phase: number;
  freq: number;
}

const WaveParticle = memo<{ seed: WaveSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const waveProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const yOff = seed.yBase * size - t * size * 0.05;
      let d = `M 0 ${yOff}`;
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const x = (s / steps) * size;
        const y =
          yOff +
          Math.sin((s / steps) * Math.PI * seed.freq + t * Math.PI * 4) * seed.amplitude * size;
        d += ` L ${x} ${y}`;
      }
      const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.05;
      return { d, opacity: alpha, strokeWidth: size * 0.015 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const crestProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const peakX = size * (0.3 + t * 0.4);
      const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size;
      const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.4);
      return { cx: peakX, cy: peakY, r: size * 0.012, opacity: alpha } as Record<string, number>;
    });

    const sprayProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const peakX = size * (0.3 + t * 0.4) + size * 0.03;
      const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size - size * 0.02;
      const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.25);
      return { cx: peakX, cy: peakY, r: size * 0.006, opacity: alpha } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={waveProps}
          stroke="rgb(60,140,200)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={crestProps} fill="rgb(180,220,255)" />
        <AnimatedCircle animatedProps={sprayProps} fill="rgb(220,240,255)" />
      </>
    );
  },
);
WaveParticle.displayName = 'WaveParticle';

export const OceanWaveFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: WAVE_COUNT }, (_, i) => ({
        yBase: 0.75 + i * 0.08,
        amplitude: 0.03 + i * 0.01,
        phase: i / WAVE_COUNT,
        freq: 2 + i,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <WaveParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
OceanWaveFlair.displayName = 'OceanWaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
