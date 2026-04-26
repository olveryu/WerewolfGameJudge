/**
 * LavaBurstFlair — 熔岩迸发
 *
 * 5 枚熔岩块从底部喷发，抛物线轨迹 + 重力下坠，带火星拖尾(3 trail circles)。
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

const BLOB_COUNT = 5;
const COLORS = [
  [255, 80, 0],
  [255, 120, 20],
  [255, 60, 10],
  [255, 100, 0],
  [255, 140, 40],
] as const;

interface BlobSeed {
  xBase: number;
  vx: number;
  vy: number;
  phase: number;
  rFrac: number;
  ci: number;
}

const BlobParticle = memo<{ seed: BlobSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci];
    const gravity = size * 1.2;

    const getPos = (t: number) => {
      'worklet';
      const x = seed.xBase * size + seed.vx * size * t;
      const y = size - (seed.vy * size * t - 0.5 * gravity * t * t);
      return { x, y };
    };

    const mainProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const { x, y } = getPos(t);
      const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.8;
      return { cx: x, cy: y, r: seed.rFrac * size, opacity: alpha } as Record<string, number>;
    });

    const trail1Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const { x, y } = getPos(Math.max(0, t - 0.04));
      return { cx: x, cy: y, r: seed.rFrac * size * 0.6, opacity: 0.4 } as Record<string, number>;
    });

    const trail2Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const { x, y } = getPos(Math.max(0, t - 0.08));
      return { cx: x, cy: y, r: seed.rFrac * size * 0.35, opacity: 0.2 } as Record<string, number>;
    });

    const trail3Props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const { x, y } = getPos(Math.max(0, t - 0.12));
      return { cx: x, cy: y, r: seed.rFrac * size * 0.2, opacity: 0.1 } as Record<string, number>;
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedCircle animatedProps={trail3Props} fill={color} />
        <AnimatedCircle animatedProps={trail2Props} fill={color} />
        <AnimatedCircle animatedProps={trail1Props} fill={color} />
        <AnimatedCircle animatedProps={mainProps} fill={color} />
      </>
    );
  },
);
BlobParticle.displayName = 'BlobParticle';

export const LavaBurstFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: BLOB_COUNT }, (_, i) => ({
        xBase: 0.3 + (i * 0.4) / (BLOB_COUNT - 1),
        vx: (i % 2 === 0 ? 1 : -1) * (0.05 + i * 0.02),
        vy: 0.8 + (i % 3) * 0.15,
        phase: i / BLOB_COUNT,
        rFrac: 0.02 + (i % 3) * 0.006,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <BlobParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
LavaBurstFlair.displayName = 'LavaBurstFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
