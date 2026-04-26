/**
 * BlazeTrailFlair — 烈焰轨迹
 *
 * 3 道火焰弧在头像周围旋转，每道弧由 AnimatedPath 绘制 + 亮头粒子。
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

const ARC_COUNT = 3;
const COLORS = [
  { outer: 'rgb(255,80,0)', mid: 'rgb(255,160,40)', core: 'rgb(255,240,180)' },
  { outer: 'rgb(255,100,20)', mid: 'rgb(255,180,60)', core: 'rgb(255,245,200)' },
  { outer: 'rgb(255,60,10)', mid: 'rgb(255,140,30)', core: 'rgb(255,235,170)' },
];

interface ArcSeed {
  phase: number;
  span: number;
}

const FlameArc = memo<{ seed: ArcSeed; size: number; progress: { value: number }; ci: number }>(
  ({ seed, size, progress, ci }) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.44;
    const { outer, mid, core } = COLORS[ci];

    const buildArcD = (radius: number, startAngle: number, endAngle: number) => {
      'worklet';
      const x1 = cx + Math.cos(startAngle) * radius;
      const y1 = cy + Math.sin(startAngle) * radius;
      const x2 = cx + Math.cos(endAngle) * radius;
      const y2 = cy + Math.sin(endAngle) * radius;
      return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    };

    const outerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const startA = t * Math.PI * 2;
      const d = buildArcD(r, startA, startA + seed.span);
      return { d, opacity: 0.25, strokeWidth: size * 0.03 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const midProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const startA = t * Math.PI * 2;
      const d = buildArcD(r, startA + seed.span * 0.15, startA + seed.span * 0.85);
      return { d, opacity: 0.45, strokeWidth: size * 0.015 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const startA = t * Math.PI * 2;
      const d = buildArcD(r, startA + seed.span * 0.3, startA + seed.span * 0.7);
      return { d, opacity: 0.65, strokeWidth: size * 0.006 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const headProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const headAngle = t * Math.PI * 2 + seed.span;
      return {
        cx: cx + Math.cos(headAngle) * r,
        cy: cy + Math.sin(headAngle) * r,
        r: size * 0.012,
        opacity: 0.7,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath animatedProps={outerProps} stroke={outer} fill="none" strokeLinecap="round" />
        <AnimatedPath animatedProps={midProps} stroke={mid} fill="none" strokeLinecap="round" />
        <AnimatedPath animatedProps={coreProps} stroke={core} fill="none" strokeLinecap="round" />
        <AnimatedCircle animatedProps={headProps} fill={core} />
      </>
    );
  },
);
FlameArc.displayName = 'FlameArc';

export const BlazeTrailFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: ARC_COUNT }, (_, i) => ({
        phase: i / ARC_COUNT,
        span: 0.8 + (i % 2) * 0.3,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FlameArc key={i} seed={s} size={size} progress={progress} ci={i} />
        ))}
      </Svg>
    </View>
  );
});
BlazeTrailFlair.displayName = 'BlazeTrailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
