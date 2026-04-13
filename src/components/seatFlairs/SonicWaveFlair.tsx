/**
 * SonicWaveFlair — 音波震荡
 *
 * 5 道青绿色声波环从中心向外脉冲扩散，带频率调制抖动。
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useEffect } from 'react';
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

const WAVE_COUNT = 5;
const SEGS = 48;

const WaveParticle = memo<{ index: number; size: number; progress: { value: number } }>(
  ({ index, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;

    const pathProps = useAnimatedProps(() => {
      'worklet';
      const wt = (progress.value * 1.2 + index / WAVE_COUNT) % 1;
      const radius = size * 0.12 + wt * size * 0.36;
      const alpha = (1 - wt) * 0.55;
      const sw = 1.5 * (1 - wt * 0.5);
      const t = progress.value;
      let d = '';
      for (let s = 0; s <= SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        const w = 1 + 0.06 * Math.sin(a * 8 + t * Math.PI * 12 + index * 2);
        const x = cx + Math.cos(a) * radius * w;
        const y = cy + Math.sin(a) * radius * w;
        d += s === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      d += ' Z';
      return { d, opacity: alpha, strokeWidth: sw } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    return <AnimatedPath animatedProps={pathProps} stroke="rgb(80,200,180)" fill="none" />;
  },
);
WaveParticle.displayName = 'WaveParticle';

const INDICES = Array.from({ length: WAVE_COUNT }, (_, i) => i);

export const SonicWaveFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {INDICES.map((i) => (
          <WaveParticle key={i} index={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SonicWaveFlair.displayName = 'SonicWaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
