/**
 * DriftFlair — Drift
 *
 * A single dot that drifts in a figure-8 / lemniscate path. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from '../FlairProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

export const DriftFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useLoopProgress(4200);

  const dotProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value * Math.PI * 2;
    // Lemniscate of Bernoulli (figure-8)
    const a = size * 0.18;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    const cx = size / 2 + (a * Math.cos(t)) / denom;
    const cy = size / 2 + (a * Math.sin(t) * Math.cos(t)) / denom;
    return { cx, cy, r: size * 0.016, opacity: 0.5 };
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedCircle animatedProps={dotProps} fill={colors.rgb} />
      </Svg>
    </View>
  );
});
DriftFlair.displayName = 'DriftFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
