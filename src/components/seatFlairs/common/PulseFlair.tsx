/**
 * PulseFlair — pulse
 *
 * 2-3 scattered spots that pulse-fade and micro-scale. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 2500;

const SPOTS = [
  { xFrac: 0.3, yFrac: 0.3, rFrac: 0.04, phase: 0 },
  { xFrac: 0.7, yFrac: 0.55, rFrac: 0.035, phase: 0.4 },
  { xFrac: 0.45, yFrac: 0.75, rFrac: 0.03, phase: 0.75 },
] as const;

const SPOT_SAMPLERS: readonly DotSampler[] = SPOTS.map((spot) => (t, size) => {
  const pulse = Math.sin(t * Math.PI * 2);
  const alpha = 0.15 + (pulse + 1) * 0.25;
  const r = size * spot.rFrac * (0.7 + (pulse + 1) * 0.3);
  return { cx: spot.xFrac * size, cy: spot.yFrac * size, r, opacity: alpha };
});

export const PulseFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SPOTS.map((spot, i) => (
      <LoopDot
        key={`${spot.xFrac}-${spot.yFrac}`}
        sample={SPOT_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={spot.phase}
        color={colors.rgb}
      />
    ))}
  </View>
));
PulseFlair.displayName = 'PulseFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
