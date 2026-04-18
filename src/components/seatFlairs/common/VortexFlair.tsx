/**
 * VortexFlair — 旋涡
 *
 * Multiple particles spiral inward and fade. Rare 级座位装饰模板 — 8 particles.
 */
import { memo, useEffect } from 'react';
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

const PARTICLE_COUNT = 8;

export const VortexFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const particleProps = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const phase = i / PARTICLE_COUNT;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + phase) % 1;
      const angle = t * Math.PI * 4 + phase * Math.PI * 2; // 2 full spirals
      const r = size * 0.38 * (1 - t); // shrink toward center
      const cx = size / 2 + Math.cos(angle) * r;
      const cy = size / 2 + Math.sin(angle) * r;
      const alpha = t < 0.1 ? t / 0.1 : 1 - t;
      return { cx, cy, r: size * 0.01, opacity: alpha * 0.5 } as Record<string, number>;
    });
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {particleProps.map((props, i) => (
          <AnimatedCircle
            key={i}
            animatedProps={props}
            fill={i % 2 === 0 ? colors.rgb : colors.rgbLight}
          />
        ))}
      </Svg>
    </View>
  );
});
VortexFlair.displayName = 'VortexFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
