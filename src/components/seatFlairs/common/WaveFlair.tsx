/**
 * WaveFlair — Wave
 *
 * Two short diagonal lines slowly translate and fade across the seat interior, simulating a glass highlight sweep.
 * Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from '../FlairProps';
import { AnimatedLine } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

/** Diagonal streak length as fraction of tile size */
const STREAK_LEN = 0.25;

export const WaveFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useLoopProgress(4200);

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
    };
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
