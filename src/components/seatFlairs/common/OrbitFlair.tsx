/**
 * OrbitFlair — Orbit
 *
 * Two dots orbiting at different radii and speeds. Template for Common-tier seat flair.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 5000;

const dot1Sampler: DotSampler = (t, size) => {
  const angle = t * Math.PI * 2;
  const r = size * 0.38;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.018,
    opacity: 0.55,
  };
};

/** Reverse direction, 1.5× speed. */
const dot2Sampler: DotSampler = (t, size) => {
  const angle = t * Math.PI * 2 * -1.5 + Math.PI;
  const r = size * 0.28;
  return {
    cx: size / 2 + Math.cos(angle) * r,
    cy: size / 2 + Math.sin(angle) * r,
    r: size * 0.014,
    opacity: 0.4,
  };
};

export const OrbitFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopDot sample={dot1Sampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
    <LoopDot sample={dot2Sampler} size={size} durationMs={LOOP_MS} color={colors.rgbLight} />
  </View>
));
OrbitFlair.displayName = 'OrbitFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
