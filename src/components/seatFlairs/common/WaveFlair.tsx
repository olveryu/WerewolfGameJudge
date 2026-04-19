/**
 * WaveFlair — 波纹
 *
 * 两条短斜线在座位内部缓慢平移+淡入淡出，模拟玻璃高光扫过。
 * Common 级座位装饰模板。
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

import type { FlairProps } from '../FlairProps';
import { AnimatedLine } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

/** Diagonal streak length as fraction of tile size */
const STREAK_LEN = 0.25;

export const WaveFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1);
  }, [progress]);

  // Single subtle streak: sweeps left→right across center
  const streakProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size * (0.15 + t * 0.7);
    const cy = size * 0.45;
    const half = (size * STREAK_LEN) / 2;
    const fade = Math.sin(t * Math.PI);
    return {
      x1: cx - half * 0.5,
      y1: cy - half,
      x2: cx + half * 0.5,
      y2: cy + half,
      opacity: fade * 0.3,
      strokeWidth: 1.5,
    } as Record<string, number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedLine animatedProps={streakProps} stroke={colors.rgb} strokeLinecap="round" />
      </Svg>
    </View>
  );
});
WaveFlair.displayName = 'WaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
