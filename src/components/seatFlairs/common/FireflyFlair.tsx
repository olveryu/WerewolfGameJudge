/**
 * FireflyFlair — 萤火
 *
 * Multiple firefly dots that move randomly and blink independently.
 * Rare 级座位装饰模板 — 6 particles with pseudo-random paths.
 */
import { memo, useEffect, useRef } from 'react';
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

const FLY_COUNT = 6;

/** Deterministic seed-based angles for each firefly so they don't all clump. */
const SEEDS = [0.13, 0.47, 0.73, 0.29, 0.61, 0.89] as const;

export const FireflyFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);
  const seedRef = useRef(SEEDS);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
  }, [progress]);

  const flyProps = Array.from({ length: FLY_COUNT }, (_, i) => {
    const seed = seedRef.current[i]!;
    const freqX = 1.0 + seed * 2;
    const freqY = 0.8 + seed * 1.5;
    const freqBlink = 2 + seed * 3;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx =
        size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * freqX + seed * 10));
      const cy =
        size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * freqY + seed * 7));
      const blink = Math.sin(t * Math.PI * 2 * freqBlink + seed * 5);
      const alpha = 0.2 + blink * blink * 0.4; // squared for sharper blink
      return { cx, cy, r: size * 0.01, opacity: alpha } as Record<string, number>;
    });
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {flyProps.map((props, i) => (
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
FireflyFlair.displayName = 'FireflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
