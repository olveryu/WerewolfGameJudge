/**
 * BreatheFlair — breathing bokeh
 *
 * Three soft dots breathe in and out of focus with a wider halo. Common-tier seat flair template.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 3200;

const DOTS = [
  { xFrac: 0.28, yFrac: 0.25, rFrac: 0.055, phase: 0 },
  { xFrac: 0.72, yFrac: 0.42, rFrac: 0.045, phase: 0.33 },
  { xFrac: 0.4, yFrac: 0.72, rFrac: 0.05, phase: 0.66 },
] as const;

const CORE_SAMPLERS: readonly DotSampler[] = DOTS.map((dot) => (t, size) => {
  const breath = Math.sin(t * Math.PI * 2);
  return {
    cx: dot.xFrac * size,
    cy: dot.yFrac * size,
    r: size * dot.rFrac * (0.85 + breath * 0.15),
    opacity: 0.2 + breath * 0.35,
  };
});

const HALO_SAMPLERS: readonly DotSampler[] = DOTS.map((dot) => (t, size) => ({
  cx: dot.xFrac * size,
  cy: dot.yFrac * size,
  r: size * dot.rFrac * 1.8,
  opacity: 0.08 + Math.sin(t * Math.PI * 2) * 0.12,
}));

export const BreatheFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {DOTS.map((dot, i) => (
      <Fragment key={`${dot.xFrac}-${dot.yFrac}`}>
        <LoopDot
          sample={HALO_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={dot.phase}
          color={colors.rgbLight}
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={dot.phase}
          color={colors.rgb}
        />
      </Fragment>
    ))}
  </View>
));
BreatheFlair.displayName = 'BreatheFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
