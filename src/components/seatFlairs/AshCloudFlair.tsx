/**
 * AshCloudFlair — Ash Cloud
 *
 * 10 ash particles drift slowly through the air in irregular Brownian motion.
 * Each particle = hazy outer halo + solid grain core.
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

import type { FlairProps } from './FlairProps';
import { AnimatedCircle } from './svgAnimatedPrimitives';

const ASH_COUNT = 10;

interface AshSeed {
  cx0: number;
  cy0: number;
  driftX: number;
  driftY: number;
  phase: number;
  rFrac: number;
}

const AshParticle = memo<{ seed: AshSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const haloProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const wobbleX = Math.sin(t * Math.PI * 3 + seed.driftX * 10) * size * 0.03;
      const wobbleY = Math.cos(t * Math.PI * 2.5 + seed.driftY * 8) * size * 0.025;
      const cx = seed.cx0 * size + seed.driftX * size * t + wobbleX;
      const cy = seed.cy0 * size + seed.driftY * size * t + wobbleY;
      const flicker = 0.08 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.05;
      return { cx, cy, r: seed.rFrac * size * 2.5, opacity: flicker };
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const wobbleX = Math.sin(t * Math.PI * 3 + seed.driftX * 10) * size * 0.03;
      const wobbleY = Math.cos(t * Math.PI * 2.5 + seed.driftY * 8) * size * 0.025;
      const cx = seed.cx0 * size + seed.driftX * size * t + wobbleX;
      const cy = seed.cy0 * size + seed.driftY * size * t + wobbleY;
      const flicker = 0.15 + Math.sin(t * Math.PI * 5 + seed.phase * 12) * 0.1;
      return { cx, cy, r: seed.rFrac * size, opacity: flicker };
    });

    return (
      <>
        <AnimatedCircle animatedProps={haloProps} fill="rgb(130,120,110)" />
        <AnimatedCircle animatedProps={coreProps} fill="rgb(90,80,70)" />
      </>
    );
  },
);
AshParticle.displayName = 'AshParticle';

export const AshCloudFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: ASH_COUNT }, (_, i) => ({
        cx0: 0.1 + (i % 5) * 0.2,
        cy0: 0.1 + Math.floor(i / 5) * 0.4,
        driftX: ((i % 3) - 1) * 0.06,
        driftY: -0.05 + (i % 2) * 0.03,
        phase: i / ASH_COUNT,
        rFrac: 0.006 + (i % 3) * 0.003,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <AshParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
AshCloudFlair.displayName = 'AshCloudFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
