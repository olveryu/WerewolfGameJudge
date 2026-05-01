/**
 * SandStormFlairFlair — 沙暴席卷
 *
 * 10 枚沙粒在圆形涡旋轨道中旋转，不同半径/速度，带尘雾拖尾。
 * (文件名双 Flair 因 ID 为 sandStormFlair)
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

const GRAIN_COUNT = 10;
const COLORS = [
  [210, 180, 120],
  [190, 160, 100],
  [220, 190, 130],
  [200, 170, 110],
  [230, 200, 140],
] as const;

interface GrainSeed {
  orbitR: number;
  angleOff: number;
  speed: number;
  phase: number;
  rFrac: number;
  ci: number;
}

const GrainParticle = memo<{ seed: GrainSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci]!;
    const cx = size / 2;
    const cy = size / 2;

    const mainProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 * seed.speed + seed.angleOff;
      return {
        cx: cx + Math.cos(angle) * seed.orbitR * size,
        cy: cy + Math.sin(angle) * seed.orbitR * size,
        r: seed.rFrac * size,
        opacity: 0.6,
      } as Record<string, number>;
    });

    const trailProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const angle = t * Math.PI * 2 * seed.speed + seed.angleOff - 0.15;
      return {
        cx: cx + Math.cos(angle) * seed.orbitR * size,
        cy: cy + Math.sin(angle) * seed.orbitR * size,
        r: seed.rFrac * size * 1.5,
        opacity: 0.12,
      } as Record<string, number>;
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedCircle animatedProps={trailProps} fill={color} />
        <AnimatedCircle animatedProps={mainProps} fill={color} />
      </>
    );
  },
);
GrainParticle.displayName = 'GrainParticle';

export const SandStormFlairFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: GRAIN_COUNT }, (_, i) => ({
        orbitR: 0.25 + (i % 4) * 0.07,
        angleOff: (i / GRAIN_COUNT) * Math.PI * 2,
        speed: 1 + (i % 3) * 0.4,
        phase: i / GRAIN_COUNT,
        rFrac: 0.008 + (i % 3) * 0.004,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <GrainParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SandStormFlairFlair.displayName = 'SandStormFlairFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
