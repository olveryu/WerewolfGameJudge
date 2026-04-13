/**
 * ButterflyFlair — 蝶影翩翩
 *
 * 4 只蝴蝶在外围环绕飞舞，翅膀扇动（双圆模拟），带身体圆点。
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

const N = 4;
const COLORS = [
  [180, 100, 220],
  [200, 120, 240],
  [160, 80, 200],
  [220, 140, 255],
] as const;

interface ButterflySeed {
  phase: number;
  orbit: number;
  speed: number;
}

const ButterflyParticle = memo<{
  seed: ButterflySeed;
  colorIndex: number;
  size: number;
  progress: { value: number };
}>(({ seed, colorIndex, size, progress }) => {
  const [cr, cg, cb] = COLORS[colorIndex];

  const wing1Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle = (t * seed.speed + seed.phase) * Math.PI * 2;
    const dist = seed.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + seed.phase * 10));
    const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
    const alpha = 0.4 + 0.4 * wingFlap;
    const bodyAngle = angle + Math.PI / 2;
    const wdx = Math.cos(bodyAngle) * wingR * 0.5;
    const wdy = Math.sin(bodyAngle) * wingR * 0.5;
    return { cx: x - wdx, cy: y - wdy, r: wingR, opacity: alpha } as Record<string, number>;
  });

  const wing2Props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle = (t * seed.speed + seed.phase) * Math.PI * 2;
    const dist = seed.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + seed.phase * 10));
    const wingR = size * 0.02 * (0.3 + 0.7 * wingFlap);
    const alpha = 0.4 + 0.4 * wingFlap;
    const bodyAngle = angle + Math.PI / 2;
    const wdx = Math.cos(bodyAngle) * wingR * 0.5;
    const wdy = Math.sin(bodyAngle) * wingR * 0.5;
    return { cx: x + wdx, cy: y + wdy, r: wingR, opacity: alpha } as Record<string, number>;
  });

  const bodyProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const cx = size / 2;
    const cy = size / 2;
    const angle = (t * seed.speed + seed.phase) * Math.PI * 2;
    const dist = seed.orbit * size + Math.sin(t * Math.PI * 4) * size * 0.03;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const wingFlap = Math.abs(Math.sin(t * Math.PI * 8 + seed.phase * 10));
    const alpha = Math.min(1, 0.4 + 0.4 * wingFlap + 0.2);
    return { cx: x, cy: y, r: size * 0.005, opacity: alpha } as Record<string, number>;
  });

  return (
    <>
      <AnimatedCircle animatedProps={wing1Props} fill={`rgb(${cr},${cg},${cb})`} />
      <AnimatedCircle animatedProps={wing2Props} fill={`rgb(${cr},${cg},${cb})`} />
      <AnimatedCircle animatedProps={bodyProps} fill={`rgb(${cr - 40},${cg - 40},${cb - 40})`} />
    </>
  );
});
ButterflyParticle.displayName = 'ButterflyParticle';

export const ButterflyFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        phase: i / N,
        orbit: 0.28 + (i % 2) * 0.08,
        speed: 0.6 + i * 0.1,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <ButterflyParticle key={i} seed={s} colorIndex={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ButterflyFlair.displayName = 'ButterflyFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
