/**
 * SparkleFlair — sparkle points
 *
 * 4 small star points twinkle in the four corners. Common-tier seat decoration template.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 2800;
const ARM_STROKE = 0.8;

const SEEDS = [
  { x: 0.1, y: 0.1, phase: 0 },
  { x: 0.9, y: 0.15, phase: 0.25 },
  { x: 0.85, y: 0.9, phase: 0.5 },
  { x: 0.15, y: 0.85, phase: 0.75 },
] as const;

function blinkAt(t: number): number {
  const blink = Math.sin(t * Math.PI * 2);
  return blink > 0 ? blink : 0;
}

const DOT_SAMPLERS: readonly DotSampler[] = SEEDS.map((seed) => (t, size) => ({
  cx: seed.x * size,
  cy: seed.y * size,
  r: size * 0.012,
  opacity: blinkAt(t) * 0.7,
}));

const H_ARM_SAMPLERS: readonly LineSampler[] = SEEDS.map((seed) => (t, size) => {
  const arm = size * 0.025;
  const cx = seed.x * size;
  const cy = seed.y * size;
  return {
    x1: cx - arm,
    y1: cy,
    x2: cx + arm,
    y2: cy,
    strokeWidth: ARM_STROKE,
    opacity: blinkAt(t) * 0.5,
  };
});

const V_ARM_SAMPLERS: readonly LineSampler[] = SEEDS.map((seed) => (t, size) => {
  const arm = size * 0.025;
  const cx = seed.x * size;
  const cy = seed.y * size;
  return {
    x1: cx,
    y1: cy - arm,
    x2: cx,
    y2: cy + arm,
    strokeWidth: ARM_STROKE,
    opacity: blinkAt(t) * 0.5,
  };
});

export const SparkleFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SEEDS.map((seed, i) => (
      <Fragment key={`${seed.x}-${seed.y}`}>
        <LoopDot
          sample={DOT_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color={colors.rgbLight}
        />
        <LoopLine
          sample={H_ARM_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color={colors.rgbLight}
        />
        <LoopLine
          sample={V_ARM_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color={colors.rgbLight}
        />
      </Fragment>
    ))}
  </View>
));
SparkleFlair.displayName = 'SparkleFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
