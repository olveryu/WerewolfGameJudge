/**
 * ShadowClawFlair — Shadow Claw
 *
 * 4 sets of three purple claw marks slash inward from corners, with pulse animation and tip sparks.
 * react-native-svg + Reanimated useAnimatedProps.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { LegendaryAura } from './legendaryEffects';
import { AnimatedCircle, AnimatedLine } from './svgAnimatedPrimitives';

interface Claw {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
}

const ClawParticle = memo<{ claw: Claw; ci: number; size: number; progress: { value: number } }>(
  ({ claw, ci, size, progress }) => {
    const scratch0Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));
      const offset = (0 - 1) * size * 0.03;
      const sx = claw.ox + claw.dy * offset;
      const sy = claw.oy + -claw.dx * offset;
      const len = size * 0.18 * pulse;
      const ex = sx + claw.dx * len;
      const ey = sy + claw.dy * len;
      return {
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        opacity: pulse * (0.6 - 0 * 0.1),
        strokeWidth: 2 - 0 * 0.4,
      };
    });

    const scratch1Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));
      const sx = claw.ox;
      const sy = claw.oy;
      const len = size * 0.18 * pulse;
      const ex = sx + claw.dx * len;
      const ey = sy + claw.dy * len;
      return {
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        opacity: pulse * (0.6 - 1 * 0.1),
        strokeWidth: 2 - 1 * 0.4,
      };
    });

    const scratch2Props = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));
      const offset = (2 - 1) * size * 0.03;
      const sx = claw.ox + claw.dy * offset;
      const sy = claw.oy + -claw.dx * offset;
      const len = size * 0.18 * pulse;
      const ex = sx + claw.dx * len;
      const ey = sy + claw.dy * len;
      return {
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        opacity: pulse * (0.6 - 2 * 0.1),
        strokeWidth: 2 - 2 * 0.4,
      };
    });

    const sparkProps = useAnimatedProps(() => {
      'worklet';
      const t = progress.value;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + ci * 0.8) * Math.PI));
      const tipX = claw.ox + claw.dx * size * 0.18 * pulse;
      const tipY = claw.oy + claw.dy * size * 0.18 * pulse;
      return { cx: tipX, cy: tipY, r: size * 0.012, opacity: pulse * 0.6 };
    });

    return (
      <>
        <AnimatedLine animatedProps={scratch0Props} stroke="rgb(120,40,160)" />
        <AnimatedLine animatedProps={scratch1Props} stroke="rgb(120,40,160)" />
        <AnimatedLine animatedProps={scratch2Props} stroke="rgb(120,40,160)" />
        <AnimatedCircle animatedProps={sparkProps} fill="rgb(180,100,220)" />
      </>
    );
  },
);
ClawParticle.displayName = 'ClawParticle';

export const ShadowClawFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(3500);
  const slowProgress = useLoopProgress(7000);

  const claws = useMemo(
    () => [
      { ox: size * 0.05, oy: size * 0.05, dx: 1, dy: 1 },
      { ox: size * 0.95, oy: size * 0.05, dx: -1, dy: 1 },
      { ox: size * 0.05, oy: size * 0.95, dx: 1, dy: -1 },
      { ox: size * 0.95, oy: size * 0.95, dx: -1, dy: -1 },
    ],
    [size],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <LegendaryAura size={size} progress={slowProgress} r={100} g={30} b={140} orbit={0.35} />
        {claws.map((claw, i) => (
          <ClawParticle key={i} claw={claw} ci={i} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ShadowClawFlair.displayName = 'ShadowClawFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
