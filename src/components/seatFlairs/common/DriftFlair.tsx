/**
 * DriftFlair — Drift
 *
 * A single dot that drifts in a figure-8 / lemniscate path. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 4200;

/** Lemniscate of Bernoulli (figure-8). */
const dotSampler: DotSampler = (t, size) => {
  const theta = t * Math.PI * 2;
  const a = size * 0.18;
  const denom = 1 + Math.sin(theta) * Math.sin(theta);
  return {
    cx: size / 2 + (a * Math.cos(theta)) / denom,
    cy: size / 2 + (a * Math.sin(theta) * Math.cos(theta)) / denom,
    r: size * 0.016,
    opacity: 0.5,
  };
};

export const DriftFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopDot sample={dotSampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
  </View>
));
DriftFlair.displayName = 'DriftFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
