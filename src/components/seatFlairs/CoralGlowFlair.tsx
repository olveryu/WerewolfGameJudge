/**
 * CoralGlowFlair — 珊瑚荧光
 *
 * 4 组分枝珊瑚形(AnimatedPath Y分叉)从底部生长，带荧光脉冲。
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
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const BRANCH_COUNT = 4;
const COLORS = [
  [255, 120, 100],
  [255, 160, 80],
  [255, 100, 120],
  [255, 140, 100],
] as const;

interface BranchSeed {
  xBase: number;
  phase: number;
  ci: number;
}

const CoralBranch = memo<{ seed: BranchSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = COLORS[seed.ci]!;

    const trunkProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const pulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
      const bx = seed.xBase * size;
      const by = size * 0.95;
      const ty = by - size * 0.35;
      const d = `M ${bx} ${by} L ${bx} ${ty}`;
      return { d, opacity: pulse * 0.4, strokeWidth: size * 0.012 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const leftProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const pulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
      const bx = seed.xBase * size;
      const forkY = size * 0.95 - size * 0.2;
      const tipX = bx - size * 0.06;
      const tipY = forkY - size * 0.12;
      const d = `M ${bx} ${forkY} Q ${bx - size * 0.03} ${forkY - size * 0.06} ${tipX} ${tipY}`;
      return { d, opacity: pulse * 0.35, strokeWidth: size * 0.008 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const rightProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const pulse = 0.6 + Math.sin(t * Math.PI * 2) * 0.4;
      const bx = seed.xBase * size;
      const forkY = size * 0.95 - size * 0.15;
      const tipX = bx + size * 0.05;
      const tipY = forkY - size * 0.1;
      const d = `M ${bx} ${forkY} Q ${bx + size * 0.03} ${forkY - size * 0.05} ${tipX} ${tipY}`;
      return { d, opacity: pulse * 0.35, strokeWidth: size * 0.008 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const tipGlowProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const pulse = Math.max(0, Math.sin(t * Math.PI * 3) * 0.6);
      const bx = seed.xBase * size;
      const tipY = size * 0.95 - size * 0.35;
      return { cx: bx, cy: tipY, r: size * 0.015, opacity: pulse } as Record<string, number>;
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedPath animatedProps={trunkProps} stroke={color} fill="none" strokeLinecap="round" />
        <AnimatedPath animatedProps={leftProps} stroke={color} fill="none" strokeLinecap="round" />
        <AnimatedPath animatedProps={rightProps} stroke={color} fill="none" strokeLinecap="round" />
        <AnimatedCircle
          animatedProps={tipGlowProps}
          fill={`rgb(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)})`}
        />
      </>
    );
  },
);
CoralBranch.displayName = 'CoralBranch';

export const CoralGlowFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: BRANCH_COUNT }, (_, i) => ({
        xBase: 0.2 + (i * 0.6) / (BRANCH_COUNT - 1),
        phase: i / BRANCH_COUNT,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <CoralBranch key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
CoralGlowFlair.displayName = 'CoralGlowFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
