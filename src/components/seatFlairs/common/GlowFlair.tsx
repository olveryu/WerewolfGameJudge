/**
 * GlowFlair — soft glow
 *
 * Faint glowing dots in the four corners with slow pulse. Common-tier seat flair template.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from '../FlairProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const CORNERS = [
  { xFrac: 0.12, yFrac: 0.12, phase: 0 },
  { xFrac: 0.88, yFrac: 0.12, phase: 0.25 },
  { xFrac: 0.88, yFrac: 0.88, phase: 0.5 },
  { xFrac: 0.12, yFrac: 0.88, phase: 0.75 },
];

const GlowDot = memo<{
  corner: (typeof CORNERS)[0];
  size: number;
  progress: { value: number };
  color: string;
}>(({ corner, size, progress, color }) => {
  const props = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + corner.phase) % 1;
    const pulse = 0.3 + Math.sin(t * Math.PI * 2) * 0.3;
    return {
      cx: corner.xFrac * size,
      cy: corner.yFrac * size,
      r: size * 0.04,
      opacity: pulse,
    };
  });
  return <AnimatedCircle animatedProps={props} fill={color} />;
});
GlowDot.displayName = 'GlowDot';

export const GlowFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useLoopProgress(3000);

  const corners = useMemo(() => CORNERS, []);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {corners.map((c, i) => (
          <GlowDot key={i} corner={c} size={size} progress={progress} color={colors.rgbLight} />
        ))}
      </Svg>
    </View>
  );
});
GlowFlair.displayName = 'GlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
