/**
 * CascadeFlair — 瀑布
 *
 * Multiple dots cascade down the sides, creating a waterfall curtain effect.
 * Rare 级座位装饰模板 — 6 animated particles with phase offsets.
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

const DOT_COUNT = 6;

export const CascadeFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1);
  }, [progress]);

  const dotProps = Array.from({ length: DOT_COUNT }, (_, i) => {
    const phase = i / DOT_COUNT;
    const side = i % 2 === 0; // true = left, false = right
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + phase) % 1;
      const cx = side ? size * 0.12 : size * 0.88;
      const cy = size * 0.1 + t * size * 0.8;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
      return { cx, cy, r: size * 0.012, opacity: alpha * 0.45 } as Record<string, number>;
    });
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {dotProps.map((props, i) => (
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
CascadeFlair.displayName = 'CascadeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
