/**
 * StormSurgeFlair — 风暴潮涌
 *
 * 雨丝 + 浪花组合：4 道倾斜 AnimatedLine 雨线 + 底部 2 道浪峰 AnimatedPath。
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
import { AnimatedLine, AnimatedPath } from './svgAnimatedPrimitives';

const RAIN_COUNT = 4;
const WAVE_LAYERS = 2;

interface RainSeed {
  xOff: number;
  phase: number;
  len: number;
}

const RainStreak = memo<{ seed: RainSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const startX = seed.xOff * size + t * size * 0.1;
      const startY = t * size * 1.2 - size * 0.1;
      const endX = startX + size * 0.03;
      const endY = startY + seed.len * size;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.2;
      return {
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        opacity: alpha,
        strokeWidth: size * 0.004,
      } as Record<string, number>;
    });
    return <AnimatedLine animatedProps={props} stroke="rgb(150,180,210)" strokeLinecap="round" />;
  },
);
RainStreak.displayName = 'RainStreak';

const WaveCrest = memo<{ layer: number; size: number; progress: { value: number } }>(
  ({ layer, size, progress }) => {
    const props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const baseY = size * (0.82 + layer * 0.08);
      const shift = Math.sin(t * Math.PI * 2 + layer * 1.5) * size * 0.04;
      const amp = size * (0.03 - layer * 0.01);
      const d = `M 0 ${baseY + shift} Q ${size * 0.15} ${baseY + shift - amp} ${size * 0.3} ${baseY + shift} T ${size * 0.6} ${baseY + shift} T ${size * 0.9} ${baseY + shift} L ${size} ${baseY + shift}`;
      const alpha = 0.15 - layer * 0.04;
      return { d, opacity: alpha, strokeWidth: size * 0.008 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });
    const color = layer === 0 ? 'rgb(80,140,200)' : 'rgb(100,160,220)';
    return <AnimatedPath animatedProps={props} stroke={color} fill="none" strokeLinecap="round" />;
  },
);
WaveCrest.displayName = 'WaveCrest';

export const StormSurgeFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const rains = useMemo(
    () =>
      Array.from({ length: RAIN_COUNT }, (_, i) => ({
        xOff: 0.1 + (i * 0.7) / (RAIN_COUNT - 1),
        phase: i / RAIN_COUNT,
        len: 0.06 + (i % 2) * 0.03,
      })),
    [],
  );

  const waves = useMemo(() => Array.from({ length: WAVE_LAYERS }, (_, i) => i), []);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {rains.map((s, i) => (
          <RainStreak key={`r${i}`} seed={s} size={size} progress={progress} />
        ))}
        {waves.map((w) => (
          <WaveCrest key={`w${w}`} layer={w} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
StormSurgeFlair.displayName = 'StormSurgeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
