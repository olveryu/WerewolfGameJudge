/**
 * ThunderBoltFlair — 雷鸣电闪
 *
 * 6 条短锯齿闪电从头像边缘向外劈出，轮流闪亮（flash→afterglow→fade）。
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
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const BOLT_COUNT = 6;
const SEGS = 4;

interface BoltSeed {
  angle: number;
  offsets: number[];
  phase: number;
}

const BoltParticle = memo<{ seed: BoltSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.38;
    const outerR = size * 0.52;
    const cosA = Math.cos(seed.angle);
    const sinA = Math.sin(seed.angle);
    const perpX = -sinA;
    const perpY = cosA;

    const computePts = (intensity: number) => {
      'worklet';
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= SEGS; s++) {
        const frac = s / SEGS;
        const r = innerR + frac * (outerR - innerR);
        const lateralOff = seed.offsets[s] * size;
        pts.push({
          x: cx + cosA * r + perpX * lateralOff,
          y: cy + sinA * r + perpY * lateralOff,
        });
      }
      return { pts, intensity };
    };

    const getIntensity = (prog: number) => {
      'worklet';
      const cycle = (prog + seed.phase) % 1;
      if (cycle < 0.15) return cycle / 0.15;
      if (cycle < 0.4) return 1 - (cycle - 0.15) / 0.25;
      return 0;
    };

    const buildD = (pts: { x: number; y: number }[]) => {
      'worklet';
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} L ${pts[3].x} ${pts[3].y} L ${pts[4].x} ${pts[4].y}`;
    };

    const layer1Props = useAnimatedProps(() => {
      'worklet';
      const intensity = getIntensity(progress.value);
      const { pts } = computePts(intensity);
      return {
        d: buildD(pts),
        opacity: intensity < 0.01 ? 0 : intensity * 0.25,
        strokeWidth: size * 0.05,
      } as { d: string; opacity: number; strokeWidth: number };
    });

    const layer2Props = useAnimatedProps(() => {
      'worklet';
      const intensity = getIntensity(progress.value);
      const { pts } = computePts(intensity);
      return {
        d: buildD(pts),
        opacity: intensity < 0.01 ? 0 : intensity * 0.5,
        strokeWidth: size * 0.025,
      } as { d: string; opacity: number; strokeWidth: number };
    });

    const layer3Props = useAnimatedProps(() => {
      'worklet';
      const intensity = getIntensity(progress.value);
      const { pts } = computePts(intensity);
      return {
        d: buildD(pts),
        opacity: intensity < 0.01 ? 0 : intensity * 0.9,
        strokeWidth: size * 0.012,
      } as { d: string; opacity: number; strokeWidth: number };
    });

    const sparkProps = useAnimatedProps(() => {
      'worklet';
      const intensity = getIntensity(progress.value);
      const { pts } = computePts(intensity);
      const tip = pts[SEGS];
      return {
        cx: tip.x,
        cy: tip.y,
        r: intensity < 0.01 ? 0 : size * 0.015 * intensity,
        opacity: intensity < 0.01 ? 0 : intensity * 0.7,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={layer1Props}
          stroke="rgb(80,160,255)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <AnimatedPath
          animatedProps={layer2Props}
          stroke="rgb(140,200,255)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <AnimatedPath
          animatedProps={layer3Props}
          stroke="rgb(220,240,255)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <AnimatedCircle animatedProps={sparkProps} fill="rgb(255,255,255)" />
      </>
    );
  },
);
BoltParticle.displayName = 'BoltParticle';

export const ThunderBoltFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const bolts = useMemo(
    () =>
      Array.from({ length: BOLT_COUNT }, (_, i) => ({
        angle: (i / BOLT_COUNT) * Math.PI * 2 - Math.PI / 2,
        offsets: Array.from(
          { length: SEGS + 1 },
          (_, s) => (s % 2 === 0 ? 1 : -1) * (0.03 + ((i * 7 + s * 3) % 5) * 0.012),
        ),
        phase: i / BOLT_COUNT,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {bolts.map((s, i) => (
          <BoltParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ThunderBoltFlair.displayName = 'ThunderBoltFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
