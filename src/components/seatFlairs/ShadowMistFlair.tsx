/**
 * ShadowMistFlair — Shadow mist
 *
 * 5 purple-black smoke puffs rise from the bottom and disperse, opacity fades out. Loops.
 * react-native-svg + Reanimated useAnimatedProps.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const N = 5;

interface MistSeed {
  xFrac: number;
  phase: number;
  maxR: number;
}

const MistParticle = memo<{ seed: MistSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const animatedProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = size * (1 - t * 0.6);
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 3) * size * 0.03;
      const r = seed.maxR * size * (0.3 + t * 0.7);
      const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.4;
      return { cx: x, cy: y, r, opacity: alpha };
    });

    return <AnimatedCircle animatedProps={animatedProps} fill="rgb(42,16,64)" />;
  },
);
MistParticle.displayName = 'MistParticle';

export const ShadowMistFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(5000);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (N - 1),
        phase: i / N,
        maxR: 0.06 + (i % 3) * 0.02,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <MistParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ShadowMistFlair.displayName = 'ShadowMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
