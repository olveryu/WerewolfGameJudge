/**
 * WillowWispFlair — 柳树鬼火
 *
 * 6 个鬼火在头像四周游荡：缓慢的 Lissajous 轨迹 + 随机闪烁明灭。
 * 每个鬼火 = 外晕 + 亮核。
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

const WISP_COUNT = 6;
const COLORS = [
  [100, 255, 180],
  [80, 240, 160],
  [120, 255, 200],
  [90, 230, 170],
  [110, 250, 190],
  [80, 220, 155],
] as const;

interface WispSeed {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  freqX: number;
  freqY: number;
  phase: number;
  ci: number;
}

const WispParticle = memo<{ seed: WispSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const [cr, cg, cb] = COLORS[seed.ci]!;

    const haloProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = cx + Math.sin(t * Math.PI * 2 * seed.freqX) * seed.ax * size;
      const y = cy + Math.cos(t * Math.PI * 2 * seed.freqY + seed.bx) * seed.ay * size;
      const flicker = 0.4 + Math.sin(t * Math.PI * 6 + seed.by) * 0.25;
      return { cx: x, cy: y, r: size * 0.025, opacity: flicker * 0.3 } as Record<string, number>;
    });

    const coreProps = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const x = cx + Math.sin(t * Math.PI * 2 * seed.freqX) * seed.ax * size;
      const y = cy + Math.cos(t * Math.PI * 2 * seed.freqY + seed.bx) * seed.ay * size;
      const flicker = 0.5 + Math.sin(t * Math.PI * 6 + seed.by) * 0.3;
      return { cx: x, cy: y, r: size * 0.008, opacity: flicker } as Record<string, number>;
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <>
        <AnimatedCircle animatedProps={haloProps} fill={color} />
        <AnimatedCircle animatedProps={coreProps} fill="rgb(220,255,240)" />
      </>
    );
  },
);
WispParticle.displayName = 'WispParticle';

export const WillowWispFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: WISP_COUNT }, (_, i) => ({
        ax: 0.2 + (i % 3) * 0.08,
        ay: 0.15 + (i % 4) * 0.06,
        bx: i * 1.1,
        by: i * 0.7,
        freqX: 1 + (i % 2) * 0.5,
        freqY: 0.8 + (i % 3) * 0.3,
        phase: i / WISP_COUNT,
        ci: i % COLORS.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <WispParticle key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
WillowWispFlair.displayName = 'WillowWispFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
