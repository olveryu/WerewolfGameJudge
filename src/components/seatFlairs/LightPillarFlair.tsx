/**
 * LightPillarFlair — 四柱天光
 *
 * 4 条金色光柱从四角向内延伸（不碰中心），带脉冲明暗。
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
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

const GLOW_STEPS = 8;

interface Corner {
  bx: number;
  by: number;
  dir: number;
}

const GlowDot = memo<{
  step: number;
  cornerIndex: number;
  corner: Corner;
  size: number;
  progress: { value: number };
}>(({ step, cornerIndex, corner, size, progress }) => {
  const props = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2.5 + cornerIndex * 0.7) * Math.PI));
    const h = size * 0.35 * pulse;
    const frac = step / GLOW_STEPS;
    const y = corner.by + corner.dir * h * frac;
    const alpha = (1 - frac) * pulse * 0.15;
    return { cx: corner.bx, cy: y, r: size * 0.025, opacity: alpha } as Record<string, number>;
  });

  return <AnimatedCircle animatedProps={props} fill="rgb(255,230,130)" />;
});
GlowDot.displayName = 'GlowDot';

const PillarParticle = memo<{
  corner: Corner;
  cornerIndex: number;
  size: number;
  progress: { value: number };
}>(({ corner, cornerIndex, size, progress }) => {
  const lineProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2.5 + cornerIndex * 0.7) * Math.PI));
    const h = size * 0.35 * pulse;
    return {
      x1: corner.bx,
      y1: corner.by,
      x2: corner.bx,
      y2: corner.by + corner.dir * h * 0.8,
      opacity: pulse * 0.6,
      strokeWidth: 1.5,
    } as Record<string, number>;
  });

  const sparkProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2.5 + cornerIndex * 0.7) * Math.PI));
    return { cx: corner.bx, cy: corner.by, r: size * 0.012, opacity: pulse * 0.8 } as Record<
      string,
      number
    >;
  });

  const glowSteps = useMemo(() => Array.from({ length: GLOW_STEPS }, (_, i) => i), []);

  return (
    <>
      {glowSteps.map((s) => (
        <GlowDot
          key={s}
          step={s}
          cornerIndex={cornerIndex}
          corner={corner}
          size={size}
          progress={progress}
        />
      ))}
      <AnimatedLine animatedProps={lineProps} stroke="rgb(255,240,180)" />
      <AnimatedCircle animatedProps={sparkProps} fill="rgb(255,245,200)" />
    </>
  );
});
PillarParticle.displayName = 'PillarParticle';

export const LightPillarFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [progress]);

  const corners = useMemo(
    () => [
      { bx: size * 0.08, by: size, dir: -1 },
      { bx: size * 0.92, by: size, dir: -1 },
      { bx: size * 0.05, by: 0, dir: 1 },
      { bx: size * 0.95, by: 0, dir: 1 },
    ],
    [size],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {corners.map((c, i) => (
          <PillarParticle key={i} corner={c} cornerIndex={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
LightPillarFlair.displayName = 'LightPillarFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
