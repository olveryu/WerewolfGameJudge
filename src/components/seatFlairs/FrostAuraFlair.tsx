/**
 * FrostAuraFlair — 寒霜气场
 *
 * 8 颗冰蓝色雪花粒子围绕头像缓慢飘浮，大小和 opacity 随机脉动。
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

const N = 8;

interface FrostSeed {
  angle0: number;
  orbitFrac: number;
  rFrac: number;
  speed: number;
}

const FrostParticle = memo<{
  seed: FrostSeed;
  index: number;
  size: number;
  progress: { value: number };
}>(({ seed, index, size, progress }) => {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const angle = seed.angle0 + progress.value * Math.PI * 2 * seed.speed;
    const orbit = seed.orbitFrac * size;
    const x = cx + Math.cos(angle) * orbit;
    const y = cy + Math.sin(angle) * orbit;
    const pulse = 0.5 + 0.5 * Math.sin(progress.value * Math.PI * 4 + index);
    const alpha = 0.3 + pulse * 0.4;
    const r = seed.rFrac * size * (0.8 + pulse * 0.4);
    return { cx: x, cy: y, r, opacity: alpha } as Record<string, number>;
  });

  return <AnimatedCircle animatedProps={animatedProps} fill="rgb(140,220,255)" />;
});
FrostParticle.displayName = 'FrostParticle';

export const FrostAuraFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        angle0: (i / N) * Math.PI * 2,
        orbitFrac: 0.42 + (i % 3) * 0.05,
        rFrac: 0.015 + (i % 4) * 0.005,
        speed: 0.8 + (i % 3) * 0.2,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FrostParticle key={i} seed={s} index={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
FrostAuraFlair.displayName = 'FrostAuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
