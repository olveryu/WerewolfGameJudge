/**
 * EmberGlowFlair — 余烬微光
 *
 * 6 颗橙色/琥珀色小圆点从底部缓慢上升，随高度渐灭后重置。
 * react-native-svg + Reanimated useAnimatedProps。
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

const PARTICLE_COUNT = 6;
const COLORS = [
  [255, 140, 0],
  [255, 180, 50],
  [255, 100, 20],
  [255, 160, 30],
  [255, 200, 80],
  [255, 120, 10],
] as const;

interface EmberSeed {
  xFrac: number;
  phase: number;
  rFrac: number;
  ci: number;
}

const EmberParticle = memo<{ seed: EmberSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci];

    const animatedProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const y = size * (1 - t);
      const x = seed.xFrac * size + Math.sin(t * Math.PI * 2) * size * 0.04;
      const r = seed.rFrac * size;
      const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
      return { cx: x, cy: y, r, opacity: alpha * 0.8 } as Record<string, number>;
    });

    return <AnimatedCircle animatedProps={animatedProps} fill={`rgb(${cr},${cg},${cb})`} />;
  },
);
EmberParticle.displayName = 'EmberParticle';

export const EmberGlowFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        xFrac: 0.15 + (i * 0.7) / (PARTICLE_COUNT - 1),
        phase: i / PARTICLE_COUNT,
        rFrac: 0.02 + (i % 3) * 0.008,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <EmberParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
EmberGlowFlair.displayName = 'EmberGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
