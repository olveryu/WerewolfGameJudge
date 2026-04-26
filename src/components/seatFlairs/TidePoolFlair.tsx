/**
 * TidePoolFlair — 潮汐水洼
 *
 * 随机位置的涟漪扩散圈：5 个涟漪源在不同时间触发，
 * 每圈 3 层同心圆扩展后消失。
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

const RINGS_PER_RIPPLE = 3;

interface RippleSeed {
  cx: number;
  cy: number;
  phase: number;
}

/** Extracted so useAnimatedProps is at component scope */
const RippleRing = memo<{
  ri: number;
  seed: RippleSeed;
  size: number;
  cx: number;
  cy: number;
  progress: { value: number };
}>(({ ri, seed, size, cx, cy, progress }) => {
  const ringDelay = ri * 0.1;
  const ringProps = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + seed.phase) % 1;
    const localT = Math.max(0, t - ringDelay);
    const expansion = localT / (1 - ringDelay);
    const r = expansion * size * 0.12;
    const alpha = expansion < 0.05 ? expansion / 0.05 : (1 - expansion) * 0.2;
    return {
      cx,
      cy,
      r: Math.max(0, r),
      opacity: Math.max(0, alpha),
      strokeWidth: size * (0.004 - ri * 0.001),
    } as Record<string, number>;
  });
  return <AnimatedCircle animatedProps={ringProps} fill="none" stroke="rgb(100,180,220)" />;
});
RippleRing.displayName = 'RippleRing';

const RippleSource = memo<{ seed: RippleSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = seed.cx * size;
    const cy = seed.cy * size;

    const rings = useMemo(() => Array.from({ length: RINGS_PER_RIPPLE }, (_, i) => i), []);

    return (
      <>
        {rings.map((ri) => (
          <RippleRing
            key={ri}
            ri={ri}
            seed={seed}
            size={size}
            cx={cx}
            cy={cy}
            progress={progress}
          />
        ))}
      </>
    );
  },
);
RippleSource.displayName = 'RippleSource';

export const TidePoolFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo<RippleSeed[]>(
    () => [
      { cx: 0.25, cy: 0.3, phase: 0 },
      { cx: 0.7, cy: 0.2, phase: 0.2 },
      { cx: 0.5, cy: 0.6, phase: 0.45 },
      { cx: 0.15, cy: 0.75, phase: 0.6 },
      { cx: 0.8, cy: 0.8, phase: 0.8 },
    ],
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <RippleSource key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
TidePoolFlair.displayName = 'TidePoolFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
