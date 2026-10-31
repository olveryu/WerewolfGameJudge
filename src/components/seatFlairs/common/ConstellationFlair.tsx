/**
 * ConstellationFlair — constellation
 *
 * Five fixed stars; the links between them fade in and out in sequence. Rare-tier seat flair
 * template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LineSampler, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 5000;
const LINK_STROKE = 0.8;

const STARS = [
  { x: 0.2, y: 0.15 },
  { x: 0.8, y: 0.2 },
  { x: 0.85, y: 0.75 },
  { x: 0.15, y: 0.8 },
  { x: 0.5, y: 0.5 },
] as const;

const LINKS: readonly [number, number][] = [
  [0, 4],
  [4, 1],
  [1, 2],
  [2, 4],
  [4, 3],
  [3, 0],
];

/** Each link fades in then out over its own segment of the loop. */
const LINK_SAMPLERS: readonly LineSampler[] = LINKS.map(([from, to]) => (t, size) => {
  const alpha = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
  return {
    x1: STARS[from]!.x * size,
    y1: STARS[from]!.y * size,
    x2: STARS[to]!.x * size,
    y2: STARS[to]!.y * size,
    strokeWidth: LINK_STROKE,
    opacity: alpha * 0.35,
  };
});

export const ConstellationFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    <Svg width={size} height={size}>
      {STARS.map((star) => (
        <Circle
          key={`${star.x}-${star.y}`}
          cx={star.x * size}
          cy={star.y * size}
          r={size * 0.012}
          fill={colors.rgb}
          opacity={0.5}
        />
      ))}
    </Svg>
    {LINKS.map(([from, to], i) => (
      <LoopLine
        key={`${from}-${to}`}
        sample={LINK_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={i / LINKS.length}
        color={colors.rgbLight}
      />
    ))}
  </View>
));
ConstellationFlair.displayName = 'ConstellationFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
