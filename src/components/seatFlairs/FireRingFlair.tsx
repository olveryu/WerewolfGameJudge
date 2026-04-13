/**
 * FireRingFlair — 烈焰之环
 *
 * 8 颗火焰粒子沿头像边缘环形运动，红→橙→黄渐变，带拖尾。
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

const N = 8;
const TRAIL = 3;
const COLORS = [
  [220, 40, 0],
  [240, 120, 0],
  [255, 180, 30],
  [220, 60, 0],
  [240, 100, 10],
  [255, 160, 20],
  [200, 30, 0],
  [240, 140, 0],
] as const;

interface FireTrailProps {
  index: number;
  trailIndex: number;
  size: number;
  progress: { value: number };
}

const FireTrailDot = memo<FireTrailProps>(({ index, trailIndex, size, progress }) => {
  const [cr, cg, cb] = COLORS[index % COLORS.length];

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;
    const r = size * 0.02;
    const baseAngle = (index / N) * Math.PI * 2 + progress.value * Math.PI * 2;
    const trailAngle = baseAngle - trailIndex * 0.08;
    const x = cx + Math.cos(trailAngle) * orbit;
    const y = cy + Math.sin(trailAngle) * orbit;
    const alphaScale = trailIndex === 0 ? 1 : (1 - trailIndex / (TRAIL + 1)) * 0.5;
    const rScale = trailIndex === 0 ? 1 : 1 - trailIndex * 0.2;
    return { cx: x, cy: y, r: r * rScale, opacity: alphaScale * 0.75 } as Record<string, number>;
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={`rgb(${cr},${cg},${cb})`} />;
});
FireTrailDot.displayName = 'FireTrailDot';

export const FireRingFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1);
  }, [progress]);

  const elements: React.JSX.Element[] = [];
  for (let i = 0; i < N; i++) {
    for (let t = TRAIL; t >= 0; t--) {
      elements.push(
        <FireTrailDot key={`${i}-${t}`} index={i} trailIndex={t} size={size} progress={progress} />,
      );
    }
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {elements}
      </Svg>
    </View>
  );
});
FireRingFlair.displayName = 'FireRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
