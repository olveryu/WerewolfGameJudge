/**
 * FireflyFlair — fireflies
 *
 * Six fireflies wander on independent sine paths and blink. Rare-tier seat flair template.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from '../FlairProps';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const LOOP_MS = 7000;

const SEEDS = [0.13, 0.47, 0.73, 0.29, 0.61, 0.89] as const;

const FLY_SAMPLERS: readonly DotSampler[] = SEEDS.map((seed) => {
  const freqX = 1.0 + seed * 2;
  const freqY = 0.8 + seed * 1.5;
  const freqBlink = 2 + seed * 3;
  return (t, size) => {
    const blink = Math.sin(t * Math.PI * 2 * freqBlink + seed * 5);
    return {
      cx: size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * freqX + seed * 10)),
      cy: size * 0.2 + size * 0.6 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * freqY + seed * 7)),
      r: size * 0.01,
      // Squared for a sharper blink
      opacity: 0.2 + blink * blink * 0.4,
    };
  };
});

export const FireflyFlair = memo<ColoredFlairProps>(({ size, colors }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SEEDS.map((seed, i) => (
      <LoopDot
        key={`fly-${seed}`}
        sample={FLY_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        color={i % 2 === 0 ? colors.rgb : colors.rgbLight}
      />
    ))}
  </View>
));
FireflyFlair.displayName = 'FireflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
