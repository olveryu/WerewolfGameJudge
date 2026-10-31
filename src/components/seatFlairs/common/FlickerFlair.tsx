/**
 * FlickerFlair — flicker
 *
 * A centre ember flickers irregularly inside a soft halo. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 1800;

/** Two overlapping sine waves give an irregular flicker. */
const coreSampler: DotSampler = (t, size) => {
  const a = Math.sin(t * Math.PI * 2) * 0.3;
  const b = Math.sin(t * Math.PI * 6) * 0.15;
  return {
    cx: size / 2,
    cy: size / 2,
    r: size * 0.03 + Math.sin(t * Math.PI * 4) * size * 0.008,
    opacity: Math.max(0, 0.35 + a + b),
  };
};

const haloSampler: DotSampler = (t, size) => ({
  cx: size / 2,
  cy: size / 2,
  r: size * 0.06,
  opacity: Math.max(0, 0.15 + Math.sin(t * Math.PI * 2) * 0.15),
});

export const FlickerFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopDot sample={haloSampler} size={size} durationMs={LOOP_MS} color={colors.rgbLight} />
    <LoopDot sample={coreSampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
  </View>
));
FlickerFlair.displayName = 'FlickerFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
