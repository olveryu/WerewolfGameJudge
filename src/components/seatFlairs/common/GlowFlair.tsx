/**
 * GlowFlair — soft glow
 *
 * Faint glowing dots in the four corners with slow pulse. Common-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 3000;

const CORNERS = [
  { xFrac: 0.12, yFrac: 0.12, phase: 0 },
  { xFrac: 0.88, yFrac: 0.12, phase: 0.25 },
  { xFrac: 0.88, yFrac: 0.88, phase: 0.5 },
  { xFrac: 0.12, yFrac: 0.88, phase: 0.75 },
] as const;

const CORNER_SAMPLERS: readonly DotSampler[] = CORNERS.map((corner) => (t, size) => ({
  cx: corner.xFrac * size,
  cy: corner.yFrac * size,
  r: size * 0.04,
  opacity: 0.3 + Math.sin(t * Math.PI * 2) * 0.3,
}));

export const GlowFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {CORNERS.map((corner, i) => (
      <LoopDot
        key={`${corner.xFrac}-${corner.yFrac}`}
        sample={CORNER_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={corner.phase}
        color={colors.rgbLight}
      />
    ))}
  </View>
));
GlowFlair.displayName = 'GlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
