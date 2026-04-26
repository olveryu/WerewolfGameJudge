/**
 * PetalDanceFlair — 花瓣飞舞
 *
 * 8 片花瓣以螺旋轨迹从上方飘落，每片花瓣 = 椭圆 AnimatedPath + 旋转摇曳。
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
import { AnimatedPath } from './svgAnimatedPrimitives';

const PETAL_COUNT = 8;
const PINK_SHADES = [
  [255, 180, 200],
  [255, 160, 190],
  [255, 200, 210],
  [240, 150, 180],
  [255, 170, 195],
  [250, 190, 205],
  [255, 155, 185],
  [245, 175, 200],
] as const;

interface PetalSeed {
  xOff: number;
  spiralR: number;
  rotSpeed: number;
  phase: number;
  petalW: number;
  petalH: number;
  ci: number;
}

const Petal = memo<{ seed: PetalSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const [cr, cg, cb] = PINK_SHADES[seed.ci];

    const props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      // Fall from top to bottom with spiral sway
      const y = t * size * 1.1 - size * 0.05;
      const x = size * seed.xOff + Math.sin(t * Math.PI * 2 * seed.rotSpeed) * seed.spiralR * size;
      // Petal shape: simple elongated ellipse approximation
      const w = seed.petalW * size;
      const h = seed.petalH * size;
      const sway = Math.sin(t * Math.PI * 4) * 0.5;
      const d = `M ${x} ${y - h} Q ${x + w + sway * w} ${y} ${x} ${y + h} Q ${x - w - sway * w} ${y} ${x} ${y - h} Z`;
      const alpha = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 0.4;
      return { d, opacity: alpha } as { d: string; opacity: number };
    });

    const color = `rgb(${cr},${cg},${cb})`;
    return (
      <AnimatedPath
        animatedProps={props}
        fill={color}
        stroke={`rgb(${cr - 20},${cg - 20},${cb - 20})`}
        strokeWidth={0.5}
      />
    );
  },
);
Petal.displayName = 'Petal';

export const PetalDanceFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1);
  }, [progress]);

  const seeds = useMemo(
    () =>
      Array.from({ length: PETAL_COUNT }, (_, i) => ({
        xOff: 0.1 + (i * 0.8) / (PETAL_COUNT - 1),
        spiralR: 0.04 + (i % 3) * 0.02,
        rotSpeed: 1 + (i % 2) * 0.5,
        phase: i / PETAL_COUNT,
        petalW: 0.015 + (i % 3) * 0.005,
        petalH: 0.025 + (i % 2) * 0.01,
        ci: i % PINK_SHADES.length,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <Petal key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
PetalDanceFlair.displayName = 'PetalDanceFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
