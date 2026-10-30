/**
 * CascadeFlair — cascade
 *
 * Six dots fall along both edges, staggered by phase. Rare-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 3200;
const DOT_COUNT = 6;

const DROPS = Array.from({ length: DOT_COUNT }, (_, i) => ({
  phase: i / DOT_COUNT,
  /** Even indices fall on the left edge, odd on the right. */
  isLeft: i % 2 === 0,
}));

const DROP_SAMPLERS: readonly DotSampler[] = DROPS.map((drop) => (t, size) => {
  const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
  return {
    cx: drop.isLeft ? size * 0.12 : size * 0.88,
    cy: size * 0.1 + t * size * 0.8,
    r: size * 0.012,
    opacity: alpha * 0.45,
  };
});

export const CascadeFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {DROPS.map((drop, i) => (
      <LoopDot
        key={`drop-${drop.phase}`}
        sample={DROP_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={drop.phase}
        color={drop.isLeft ? colors.rgb : colors.rgbLight}
      />
    ))}
  </View>
));
CascadeFlair.displayName = 'CascadeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
