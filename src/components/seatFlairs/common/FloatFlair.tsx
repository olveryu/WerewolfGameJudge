/**
 * FloatFlair — floating dot
 *
 * A dot and its trailing echo follow a Lissajous curve. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 4000;
/** The echo lags the head by this fraction of the loop. */
const TRAIL_LAG = 0.04;

/** Lissajous curve (3:2 frequency ratio); amplitude stays inside the tile. */
function lissajous(t: number, size: number): { cx: number; cy: number } {
  const theta = t * Math.PI * 2;
  const amp = size * 0.28;
  return {
    cx: size / 2 + Math.sin(theta * 3) * amp * 0.8,
    cy: size / 2 + Math.cos(theta * 2) * amp * 0.7,
  };
}

const headSampler: DotSampler = (t, size) => ({
  ...lissajous(t, size),
  r: size * 0.02,
  opacity: 0.4 + Math.sin(t * Math.PI * 2 * 4) * 0.25,
});

const trailSampler: DotSampler = (t, size) => ({
  ...lissajous((t - TRAIL_LAG + 1) % 1, size),
  r: size * 0.015,
  opacity: 0.18,
});

export const FloatFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopDot sample={trailSampler} size={size} durationMs={LOOP_MS} color={colors.rgbLight} />
    <LoopDot sample={headSampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
  </View>
));
FloatFlair.displayName = 'FloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
