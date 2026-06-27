/**
 * ObsidianPulseFlair — Obsidian Pulse
 *
 * 4 dark geometric diamonds expand outward from the center then contract, alternating in a breathing rhythm.
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useLoopProgress } from '@/hooks/useLoopProgress';

import type { FlairProps } from './FlairProps';
import { AnimatedPath } from './svgAnimatedPrimitives';

const SHAPE_COUNT = 4;

interface ShapeSeed {
  rotation: number;
  phase: number;
}

const DiamondShape = memo<{ seed: ShapeSeed; size: number; progress: { value: number } }>(
  ({ seed, size, progress }) => {
    const cx = size / 2;
    const cy = size / 2;

    const props = useAnimatedProps(() => {
      'worklet';
      const t = (progress.value + seed.phase) % 1;
      const breathe = 0.5 + Math.sin(t * Math.PI * 2) * 0.5;
      const r = size * (0.15 + breathe * 0.3);
      const angle = seed.rotation;
      const top = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
      const right = {
        x: cx + Math.cos(angle + Math.PI / 2) * r * 0.5,
        y: cy + Math.sin(angle + Math.PI / 2) * r * 0.5,
      };
      const bottom = {
        x: cx + Math.cos(angle + Math.PI) * r,
        y: cy + Math.sin(angle + Math.PI) * r,
      };
      const left = {
        x: cx + Math.cos(angle + Math.PI * 1.5) * r * 0.5,
        y: cy + Math.sin(angle + Math.PI * 1.5) * r * 0.5,
      };
      const d = `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
      const alpha = 0.1 + breathe * 0.15;
      return { d, opacity: alpha, strokeWidth: size * 0.004 };
    });

    return (
      <AnimatedPath
        animatedProps={props}
        stroke="rgb(120,100,140)"
        fill="rgb(40,30,60)"
        strokeLinejoin="miter"
      />
    );
  },
);
DiamondShape.displayName = 'DiamondShape';

export const ObsidianPulseFlair = memo<FlairProps>(({ size, borderRadius: _br }) => {
  const progress = useLoopProgress(3500);

  const seeds = useMemo(
    () =>
      Array.from({ length: SHAPE_COUNT }, (_, i) => ({
        rotation: (i / SHAPE_COUNT) * Math.PI * 2,
        phase: i / SHAPE_COUNT,
      })),
    [],
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {seeds.map((s, i) => (
          <DiamondShape key={i} seed={s} size={size} progress={progress} />
        ))}
      </Svg>
    </View>
  );
});
ObsidianPulseFlair.displayName = 'ObsidianPulseFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
