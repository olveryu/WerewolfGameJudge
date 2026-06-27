/**
 * LightPillarFlair — Four Light Pillars
 *
 * 4 golden light pillars extend inward from the four corners (not reaching the center), with pulsing brightness.
 * react-native-svg + Reanimated useAnimatedProps。
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

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
    return { cx: corner.bx, cy: y, r: size * 0.025, opacity: alpha };
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
    };
  });

  const sparkProps = useAnimatedProps(() => {
    'worklet';
    const t = progress.value;
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2.5 + cornerIndex * 0.7) * Math.PI));
    return { cx: corner.bx, cy: corner.by, r: size * 0.012, opacity: pulse * 0.8 };
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
  const progress = useLoopProgress(4000);

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
