/**
 * SolarFlareFlair — 日冕耀斑
 *
 * 4 道弧形耀斑从边缘喷射，三层(外晕/中层/芯)叠加，尖端粒子。
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

const FLARE_COUNT = 4;

interface FlareSeed {
  angle: number;
  phase: number;
  arcSpan: number;
}

const FlareParticle = memo<{ seed: FlareSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.42;

    const buildArc = (r: number, span: number, a: number) => {
      'worklet';
      const a1 = a - span / 2;
      const a2 = a + span / 2;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const x2 = cx + Math.cos(a2) * r;
      const y2 = cy + Math.sin(a2) * r;
      return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
    };

    const outerProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const intensity = t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : (1 - t) / 0.4;
      const r = baseR + intensity * size * 0.12;
      const d = buildArc(r, seed.arcSpan, seed.angle + t * 0.3);
      return { d, opacity: intensity * 0.2, strokeWidth: size * 0.04 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const midProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const intensity = t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : (1 - t) / 0.4;
      const r = baseR + intensity * size * 0.1;
      const d = buildArc(r, seed.arcSpan * 0.7, seed.angle + t * 0.3);
      return { d, opacity: intensity * 0.4, strokeWidth: size * 0.02 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const intensity = t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : (1 - t) / 0.4;
      const r = baseR + intensity * size * 0.08;
      const d = buildArc(r, seed.arcSpan * 0.4, seed.angle + t * 0.3);
      return { d, opacity: intensity * 0.7, strokeWidth: size * 0.008 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const tipProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const intensity = t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : (1 - t) / 0.4;
      const r = baseR + intensity * size * 0.14;
      const tipAngle = seed.angle + t * 0.3 + seed.arcSpan / 2;
      return {
        cx: cx + Math.cos(tipAngle) * r,
        cy: cy + Math.sin(tipAngle) * r,
        r: size * 0.012 * intensity,
        opacity: intensity * 0.6,
      } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={outerProps}
          stroke="rgb(255,120,40)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={midProps}
          stroke="rgb(255,180,60)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedPath
          animatedProps={coreProps}
          stroke="rgb(255,240,200)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={tipProps} fill="rgb(255,255,200)" />
      </>
    );
  },
);
FlareParticle.displayName = 'FlareParticle';

export const SolarFlareFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: FLARE_COUNT }, (_, i) => ({
        angle: (i / FLARE_COUNT) * Math.PI * 2 - Math.PI / 4,
        phase: i / FLARE_COUNT,
        arcSpan: 0.6 + (i % 2) * 0.3,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <FlareParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
SolarFlareFlair.displayName = 'SolarFlareFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
