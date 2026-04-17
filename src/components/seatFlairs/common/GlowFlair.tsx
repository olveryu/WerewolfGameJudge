/**
 * GlowFlair — 微光
 *
 * 四角微弱发光点，缓慢脉冲。Common 级座位装饰模板。
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

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
    } as Record<string, number>;
  });
  return <AnimatedCircle animatedProps={props} fill={color} />;
});
GlowDot.displayName = 'GlowDot';

export const GlowFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

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
