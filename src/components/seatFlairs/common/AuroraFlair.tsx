/**
 * AuroraFlair — 极光
 *
 * A slow-breathing colored arc that sweeps over the top edge.
 * Rare 级座位装饰模板 — animated path with shifting control points.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

export const AuroraFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const arc1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const w = size;
    const yBase = size * 0.12;
    const amp = size * 0.06;
    const cp1y = yBase + Math.sin(t * Math.PI * 2) * amp;
    const cp2y = yBase + Math.sin(t * Math.PI * 2 + 1.5) * amp;
    return {
      d: `M 0 ${yBase} C ${w * 0.3} ${cp1y}, ${w * 0.7} ${cp2y}, ${w} ${yBase}`,
      opacity: 0.35 + Math.sin(t * Math.PI * 2) * 0.1,
    } as Record<string, string | number>;
  });

  const arc2Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const w = size;
    const yBase = size * 0.16;
    const amp = size * 0.04;
    const cp1y = yBase + Math.sin(t * Math.PI * 2 + Math.PI) * amp;
    const cp2y = yBase + Math.sin(t * Math.PI * 2 + Math.PI + 1.2) * amp;
    return {
      d: `M 0 ${yBase} C ${w * 0.25} ${cp1y}, ${w * 0.75} ${cp2y}, ${w} ${yBase}`,
      opacity: 0.2 + Math.sin(t * Math.PI * 2 + 1) * 0.1,
    } as Record<string, string | number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedPath
          animatedProps={arc1Props}
          fill="none"
          stroke={colors.rgb}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={arc2Props}
          fill="none"
          stroke={colors.rgbLight}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});
AuroraFlair.displayName = 'AuroraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
