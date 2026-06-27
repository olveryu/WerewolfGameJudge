/**
 * MistVeilFlair — Mist Veil
 *
 * 5 large semi-transparent mist clouds drift past, each with a bright inner core.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const FOG_COUNT = 5;

interface FogSeed {
  startX: number;
  yBase: number;
  phase: number;
  rFrac: number;
}

const FogParticle = memo<{ seed: FogSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const outerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = (seed.startX + t * 1.2 - 0.1) * size;
      const y = seed.yBase * size + Math.sin(t * Math.PI * 2) * size * 0.04;
      const fadeIn = Math.min(t * 5, 1);
      const fadeOut = Math.min((1 - t) * 5, 1);
      return {
        cx: x,
        cy: y,
        r: seed.rFrac * size,
        opacity: fadeIn * fadeOut * 0.06,
      };
    });

    const innerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = (seed.startX + t * 1.2 - 0.1) * size;
      const y = seed.yBase * size + Math.sin(t * Math.PI * 2) * size * 0.04;
      const fadeIn = Math.min(t * 5, 1);
      const fadeOut = Math.min((1 - t) * 5, 1);
      return {
        cx: x,
        cy: y,
        r: seed.rFrac * size * 0.4,
        opacity: fadeIn * fadeOut * 0.12,
      };
    });

    return (
      <>
        <AnimatedCircle animatedProps={outerProps} fill="rgb(200,210,220)" />
        <AnimatedCircle animatedProps={innerProps} fill="rgb(230,235,245)" />
      </>
    );
  },
);
FogParticle.displayName = 'FogParticle';

export const MistVeilFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(7000);

  const seeds = useMemo(
    () =>
      Array.from({ length: FOG_COUNT }, (_, i) => ({
        startX: -0.1 + (i % 2) * 0.1,
        yBase: 0.2 + (i * 0.6) / (FOG_COUNT - 1),
        phase: i / FOG_COUNT,
        rFrac: 0.12 + (i % 3) * 0.04,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FogParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
MistVeilFlair.displayName = 'MistVeilFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
