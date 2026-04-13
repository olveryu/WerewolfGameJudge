/**
 * LunarHaloFlair — 月华光环
 *
 * 3 条新月弧光带绕头像旋转，端点带辉光球。
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
import { AnimatedCircle, AnimatedPath } from './svgAnimatedPrimitives';

const ARC_COUNT = 3;
const ARC_SPAN = Math.PI * 0.6;

const ArcParticle = memo<{ index: number; size: number; progress: { value: number } }>(
  ({ index, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;
    const orbit = size * 0.42;

    const arcProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = t * Math.PI * 2 + index * ((Math.PI * 2) / ARC_COUNT);
      const pulse = 0.4 + 0.6 * Math.sin((t * 4 + index) * Math.PI);
      const r = orbit - index * size * 0.02;
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;
      const ex = cx + Math.cos(angle + ARC_SPAN) * r;
      const ey = cy + Math.sin(angle + ARC_SPAN) * r;
      const d = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
      return { d, opacity: pulse * 0.5, strokeWidth: 3 - index * 0.5 } as {
        d: string;
        opacity: number;
        strokeWidth: number;
      };
    });

    const glowProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const angle = t * Math.PI * 2 + index * ((Math.PI * 2) / ARC_COUNT);
      const pulse = 0.4 + 0.6 * Math.sin((t * 4 + index) * Math.PI);
      const r = orbit - index * size * 0.02;
      const ex = cx + Math.cos(angle + ARC_SPAN) * r;
      const ey = cy + Math.sin(angle + ARC_SPAN) * r;
      return { cx: ex, cy: ey, r: size * 0.02, opacity: pulse * 0.7 } as Record<string, number>;
    });

    return (
      <>
        <AnimatedPath
          animatedProps={arcProps}
          stroke="rgb(180,200,255)"
          fill="none"
          strokeLinecap="round"
        />
        <AnimatedCircle animatedProps={glowProps} fill="rgb(200,220,255)" />
      </>
    );
  },
);
ArcParticle.displayName = 'ArcParticle';

export const LunarHaloFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [progress]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {Array.from({ length: ARC_COUNT }, (_, i) => (
          <ArcParticle key={i} index={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
LunarHaloFlair.displayName = 'LunarHaloFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
