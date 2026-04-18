/**
 * WaveFlair — 波纹
 *
 * A horizontal sine wave that ripples along the bottom edge. Common 级座位装饰模板。
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

export const WaveFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1);
  }, [progress]);

  const pathProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const y0 = size * 0.88;
    const amp = size * 0.04;
    const segments = 24;
    const dx = size / segments;
    let d = `M 0 ${y0}`;
    for (let i = 1; i <= segments; i++) {
      const x = i * dx;
      const phase = t * Math.PI * 2 + (i / segments) * Math.PI * 4;
      const y = y0 + Math.sin(phase) * amp;
      d += ` L ${x} ${y}`;
    }
    return { d, opacity: 0.4 } as Record<string, string | number>;
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <AnimatedPath animatedProps={pathProps} fill="none" stroke={colors.rgb} strokeWidth={1.2} />
      </Svg>
    </View>
  );
});
WaveFlair.displayName = 'WaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
