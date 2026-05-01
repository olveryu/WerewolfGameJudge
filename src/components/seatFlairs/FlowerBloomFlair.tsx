/**
 * FlowerBloomFlair — 繁花盛开
 *
 * 5 朵小花在外围交替绽放，每朵 5 片花瓣（圆点簇）+ 花心。
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useEffect } from 'react';
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

const COLORS = [
  [255, 130, 160],
  [255, 150, 180],
  [240, 120, 170],
  [255, 160, 140],
  [250, 140, 190],
] as const;

const FlowerParticle = memo<{ flowerIndex: number; size: number; progress: { value: number } }>(
  ({ flowerIndex, size, progress }) => {
    const [cr, cg, cb] = COLORS[flowerIndex]!;
    const f = flowerIndex;

    const petal0Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const pa = (0 / 5) * Math.PI * 2 + t * Math.PI;
      return {
        cx: fx + Math.cos(pa) * petalR * 1.2,
        cy: fy + Math.sin(pa) * petalR * 1.2,
        r: petalR * 0.7,
        opacity: bloom * 0.5,
      } as Record<string, number>;
    });

    const petal1Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const pa = (1 / 5) * Math.PI * 2 + t * Math.PI;
      return {
        cx: fx + Math.cos(pa) * petalR * 1.2,
        cy: fy + Math.sin(pa) * petalR * 1.2,
        r: petalR * 0.7,
        opacity: bloom * 0.5,
      } as Record<string, number>;
    });

    const petal2Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const pa = (2 / 5) * Math.PI * 2 + t * Math.PI;
      return {
        cx: fx + Math.cos(pa) * petalR * 1.2,
        cy: fy + Math.sin(pa) * petalR * 1.2,
        r: petalR * 0.7,
        opacity: bloom * 0.5,
      } as Record<string, number>;
    });

    const petal3Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const pa = (3 / 5) * Math.PI * 2 + t * Math.PI;
      return {
        cx: fx + Math.cos(pa) * petalR * 1.2,
        cy: fy + Math.sin(pa) * petalR * 1.2,
        r: petalR * 0.7,
        opacity: bloom * 0.5,
      } as Record<string, number>;
    });

    const petal4Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      const pa = (4 / 5) * Math.PI * 2 + t * Math.PI;
      return {
        cx: fx + Math.cos(pa) * petalR * 1.2,
        cy: fy + Math.sin(pa) * petalR * 1.2,
        r: petalR * 0.7,
        opacity: bloom * 0.5,
      } as Record<string, number>;
    });

    const centerProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const cx = size / 2;
      const cy = size / 2;
      const dist = size * 0.32;
      const baseAngle = (f / 5) * Math.PI * 2;
      const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
      const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
      const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
      const petalR = size * 0.015 * bloom;
      return { cx: fx, cy: fy, r: petalR * 0.4, opacity: bloom * 0.8 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedCircle animatedProps={petal0Props} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={petal1Props} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={petal2Props} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={petal3Props} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={petal4Props} fill={`rgb(${cr},${cg},${cb})`} />
        <AnimatedCircle animatedProps={centerProps} fill="rgb(255,230,150)" />
      </>
    );
  },
);
FlowerParticle.displayName = 'FlowerParticle';

const FLOWER_INDICES = [0, 1, 2, 3, 4] as const;

export const FlowerBloomFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {FLOWER_INDICES.map((i) => (
          <FlowerParticle key={i} flowerIndex={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
FlowerBloomFlair.displayName = 'FlowerBloomFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
