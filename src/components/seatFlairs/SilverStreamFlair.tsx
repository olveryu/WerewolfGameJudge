/**
 * SilverStreamFlair — 银流蜿蜒
 *
 * 2 道银色液流从两侧顶部沿边缘向下流淌，AnimatedPath 弧线 + 波光粒子。
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

interface StreamSeed {
  side: 'left' | 'right';
  phase: number;
}

const GLEAM_PER_STREAM = 3;

/** Extracted so useAnimatedProps is at component scope */
const StreamGleam = memo<{
  idx: number;
  frac: number;
  xEdge: number;
  size: number;
  seed: StreamSeed;
  progress: { value: number };
}>(({ idx, frac, xEdge, size, seed, progress }) => {
  const gleamProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const flowLen = t * size * 1.0;
    const gy = frac * flowLen;
    const visible = gy > 0 && gy < size;
    return {
      cx: xEdge + Math.sin(t * Math.PI * 6 + idx) * size * 0.01,
      cy: gy,
      r: size * 0.006,
      opacity: visible ? 0.5 + Math.sin(t * Math.PI * 8 + idx * 2) * 0.3 : 0,
    } as Record<string, number>;
  });
  return <AnimatedCircle animatedProps={gleamProps} fill="rgb(240,245,255)" />;
});
StreamGleam.displayName = 'StreamGleam';

const StreamFlow = memo<{ seed: StreamSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const isLeft = seed.side === 'left';
    const xEdge = isLeft ? size * 0.08 : size * 0.92;
    const xMid = isLeft ? size * 0.06 : size * 0.94;

    const pathProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const flowLen = t * size * 1.0;
      const y0 = 0;
      const y1 = Math.min(size * 0.35, flowLen);
      const y2 = Math.min(size * 0.7, flowLen);
      const y3 = Math.min(size, flowLen);
      const wobble = Math.sin(t * Math.PI * 4) * size * 0.015;
      const d = `M ${xEdge} ${y0} Q ${xMid + wobble} ${y1} ${xEdge - wobble} ${y2} Q ${xMid + wobble * 0.5} ${(y2 + y3) / 2} ${xEdge} ${y3}`;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.25;
      return { d, opacity: alpha, strokeWidth: size * 0.012 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const gleams = useMemo(
      () =>
        Array.from({ length: GLEAM_PER_STREAM }, (_, i) => ({
          frac: 0.2 + (i / (GLEAM_PER_STREAM - 1)) * 0.6,
        })),
      [],
    );

    return (
      <>
        <AnimatedPath
          animatedProps={pathProps}
          stroke="rgb(200,210,220)"
          fill="none"
          strokeLinecap="round"
        />
        {gleams.map((g, i) => (
          <StreamGleam
            key={i}
            idx={i}
            frac={g.frac}
            xEdge={xEdge}
            size={size}
            seed={seed}
            progress={progress}
          />
        ))}
      </>
    );
  },
);
StreamFlow.displayName = 'StreamFlow';

export const SilverStreamFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo<StreamSeed[]>(
    () => [
      { side: 'left', phase: 0 },
      { side: 'right', phase: 0.3 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <StreamFlow key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SilverStreamFlair.displayName = 'SilverStreamFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
