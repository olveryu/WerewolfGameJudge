/**
 * ConstellationFlair — constellation
 *
 * Fixed dot positions connected by fading lines that appear sequentially.
 * Rare-tier seat flair template — static dots + animated connecting lines.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from '../FlairProps';
import { AnimatedLine } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

/** 5 star positions (relative to size 0-1) */
const STARS = [
  { x: 0.2, y: 0.15 },
  { x: 0.8, y: 0.2 },
  { x: 0.85, y: 0.75 },
  { x: 0.15, y: 0.8 },
  { x: 0.5, y: 0.5 },
] as const;

/** Line connections between stars (indices into STARS) */
const LINKS: readonly [number, number][] = [
  [0, 4],
  [4, 1],
  [1, 2],
  [2, 4],
  [4, 3],
  [3, 0],
];

export const ConstellationFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useLoopProgress(5000);

  const lineProps = LINKS.map((link, i) => {
    const phase = i / LINKS.length;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + phase) % 1;
      // Each line fades in then out over its segment
      const alpha = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
      return {
        x1: STARS[link[0]]!.x * size,
        y1: STARS[link[0]]!.y * size,
        x2: STARS[link[1]]!.x * size,
        y2: STARS[link[1]]!.y * size,
        opacity: alpha * 0.35,
      };
    });
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {STARS.map((star, i) => (
          <Circle
            key={`s${i}`}
            cx={star.x * size}
            cy={star.y * size}
            r={size * 0.012}
            fill={colors.rgb}
            opacity={0.5}
          />
        ))}
        {lineProps.map((props, i) => (
          <AnimatedLine
            key={`l${i}`}
            animatedProps={props}
            stroke={colors.rgbLight}
            strokeWidth={0.8}
          />
        ))}
      </Svg>
    </View>
  );
});
ConstellationFlair.displayName = 'ConstellationFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
