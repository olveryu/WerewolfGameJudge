/**
 * PulseFlair — 脉冲
 *
 * 2-3 个散布光斑，脉冲式明灭+微缩放。Common 级座位装饰模板。
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

import type { FlairProps } from '../FlairProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';
import type { FlairColorSet } from './palette';

interface ColoredFlairProps extends FlairProps {
  colors: FlairColorSet;
}

const SPOTS = [
  { xFrac: 0.3, yFrac: 0.3, rFrac: 0.04, phase: 0 },
  { xFrac: 0.7, yFrac: 0.55, rFrac: 0.035, phase: 0.4 },
  { xFrac: 0.45, yFrac: 0.75, rFrac: 0.03, phase: 0.75 },
] as const;

const PulseSpot = memo<{
  spot: (typeof SPOTS)[number];
  size: number;
  progress: { value: number };
  color: string;
}>(({ spot, size, progress, color }) => {
  const props = useAnimatedProps(() => {
    'worklet';
    const t = (progress.value + spot.phase) % 1;
    const pulse = Math.sin(t * Math.PI * 2);
    const alpha = 0.15 + (pulse + 1) * 0.25;
    const r = size * spot.rFrac * (0.7 + (pulse + 1) * 0.3);
    return { cx: spot.xFrac * size, cy: spot.yFrac * size, r, opacity: alpha } as Record<
      string,
      number
    >;
  });
  return <AnimatedCircle animatedProps={props} fill={color} />;
});
PulseSpot.displayName = 'PulseSpot';

export const PulseFlair = memo<ColoredFlairProps>(({ size, colors }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.linear }), -1);
  }, [progress]);

  const spots = useMemo(() => SPOTS, []);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {spots.map((s, i) => (
          <PulseSpot key={i} spot={s} size={size} progress={progress} color={colors.rgb} />
        ))}
      </Svg>
    </View>
  );
});
PulseFlair.displayName = 'PulseFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
