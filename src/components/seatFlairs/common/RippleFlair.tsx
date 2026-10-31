/**
 * RippleFlair — ripple
 *
 * Two rings expand from one point and fade, half a cycle apart. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 2800;
const MAX_R = 0.32;

const ring1Sampler: RingSampler = (t, size) => ({
  cx: size * 0.45,
  cy: size * 0.48,
  r: size * 0.04 + t * size * MAX_R,
  strokeWidth: 1.5,
  opacity: (1 - t) * 0.45,
});

const ring2Sampler: RingSampler = (t, size) => ({
  cx: size * 0.45,
  cy: size * 0.48,
  r: size * 0.04 + t * size * MAX_R,
  strokeWidth: 1,
  opacity: (1 - t) * 0.35,
});

export const RippleFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopRing sample={ring1Sampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
    <LoopRing
      sample={ring2Sampler}
      size={size}
      durationMs={LOOP_MS}
      phase={0.5}
      color={colors.rgbLight}
    />
  </View>
));
RippleFlair.displayName = 'RippleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
