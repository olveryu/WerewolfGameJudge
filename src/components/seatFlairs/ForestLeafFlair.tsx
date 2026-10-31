/**
 * ForestLeafFlair — Autumn Leaves
 *
 * 7 orange-brown leaves spiral down from above, oval-shaped with leaf vein lines.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const N = 7;
const COLORS = [
  [180, 100, 30],
  [200, 120, 40],
  [160, 80, 20],
  [190, 110, 35],
  [170, 90, 25],
  [210, 130, 45],
  [175, 95, 28],
] as const;

const LEAF_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.1 + (i * 0.8) / (N - 1),
  phase: i / N,
  rotSpeed: 1 + (i % 3) * 0.7,
  sway: 0.03 + (i % 3) * 0.02,
  rFrac: 0.02 + (i % 3) * 0.005,
  colorIndex: i,
}));

type LeafSeed = (typeof LEAF_SEEDS)[number];

/**
 * The fall runs at 0.6× loop speed with `seed.phase` added before the wrap, so it is not a pure
 * time shift of the loop and stays inside the sampler.
 */
function leafFrame(seed: LeafSeed, t: number, size: number) {
  const tt = (t * 0.6 + seed.phase) % 1;
  const y = tt * size;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 3) * size * seed.sway;
  const alpha = tt < 0.08 ? tt / 0.08 : tt > 0.85 ? (1 - tt) / 0.15 : 0.65;
  const rot = tt * Math.PI * seed.rotSpeed;
  const r = seed.rFrac * size;
  const dx = Math.cos(rot) * r * 0.3;
  const dy = Math.sin(rot) * r * 0.3;
  return { x, y, alpha, r, dx, dy };
}

const CIRCLE1_SAMPLERS: readonly DotSampler[] = LEAF_SEEDS.map((seed) => (t, size) => {
  const { x, y, alpha, r, dx, dy } = leafFrame(seed, t, size);
  return { cx: x - dx, cy: y - dy, r, opacity: alpha * 0.7 };
});

const CIRCLE2_SAMPLERS: readonly DotSampler[] = LEAF_SEEDS.map((seed) => (t, size) => {
  const { x, y, alpha, r, dx, dy } = leafFrame(seed, t, size);
  return { cx: x + dx, cy: y + dy, r: r * 0.8, opacity: alpha * 0.7 };
});

const VEIN_SAMPLERS: readonly LineSampler[] = LEAF_SEEDS.map((seed) => (t, size) => {
  const { x, y, alpha, dx, dy } = leafFrame(seed, t, size);
  return {
    x1: x - dx * 2,
    y1: y - dy * 2,
    x2: x + dx * 2,
    y2: y + dy * 2,
    opacity: alpha * 0.5,
    strokeWidth: 0.5,
  };
});

function leafColors(colorIndex: number): { body: string; vein: string } {
  const [cr, cg, cb] = COLORS[colorIndex]!;
  return {
    body: `rgb(${cr},${cg},${cb})`,
    vein: `rgb(${cr - 20},${cg - 20},${cb - 10})`,
  };
}

export const ForestLeafFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {LEAF_SEEDS.map((seed, i) => {
      const { body, vein } = leafColors(seed.colorIndex);
      return (
        <Fragment key={`leaf-${seed.xFrac}`}>
          <LoopDot sample={CIRCLE1_SAMPLERS[i]!} size={size} durationMs={LOOP_MS} color={body} />
          <LoopDot sample={CIRCLE2_SAMPLERS[i]!} size={size} durationMs={LOOP_MS} color={body} />
          <LoopLine sample={VEIN_SAMPLERS[i]!} size={size} durationMs={LOOP_MS} color={vein} />
        </Fragment>
      );
    })}
  </View>
));
ForestLeafFlair.displayName = 'ForestLeafFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
