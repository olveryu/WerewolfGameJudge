/**
 * WaveFlair — Wave
 *
 * A short diagonal streak sweeps left→right across the seat interior and fades, simulating a
 * glass highlight. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type LineSampler, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 4200;
/** Diagonal streak length as fraction of tile size */
const STREAK_LEN = 0.25;

const streakSampler: LineSampler = (t, size) => {
  const cx = size * (0.15 + t * 0.7);
  const cy = size * 0.45;
  const half = (size * STREAK_LEN) / 2;
  return {
    x1: cx - half * 0.5,
    y1: cy - half,
    x2: cx + half * 0.5,
    y2: cy + half,
    strokeWidth: 1.5,
    opacity: Math.sin(t * Math.PI) * 0.3,
  };
};

export const WaveFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <LoopLine sample={streakSampler} size={size} durationMs={LOOP_MS} color={colors.rgb} />
  </View>
));
WaveFlair.displayName = 'WaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
