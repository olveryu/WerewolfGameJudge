/**
 * ThunderClapFlair — Thunder Clap
 *
 * A single large lightning bolt strikes from top to bottom in three layers (outer halo / mid / core) + 4 scattered sparks.
 * Periodic flash cycle: quick flash → afterglow → dark → repeat.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot, LoopPath, type PathSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;

const BOLT_LAYERS = [
  { color: 'rgb(80,140,255)', widthMul: 0.04, opacityMul: 0.3 },
  { color: 'rgb(160,200,255)', widthMul: 0.02, opacityMul: 0.6 },
  { color: 'rgb(240,245,255)', widthMul: 0.008, opacityMul: 0.9 },
] as const;

const SPARK_SEEDS = [
  { dx: -0.15, dy: -0.1, phase: 0 },
  { dx: 0.12, dy: -0.08, phase: 0 },
  { dx: -0.1, dy: 0.12, phase: 0 },
  { dx: 0.14, dy: 0.1, phase: 0 },
] as const;

function boltPath(size: number): string {
  const cx = size * 0.5;
  return `M ${cx} 0 L ${cx - size * 0.08} ${size * 0.25} L ${cx + size * 0.05} ${size * 0.35} L ${cx - size * 0.1} ${size * 0.55} L ${cx + size * 0.06} ${size * 0.7} L ${cx - size * 0.04} ${size}`;
}

const BOLT_SAMPLERS: readonly PathSampler[] = BOLT_LAYERS.map((layer) => (t, size) => {
  const flash =
    t < 0.1
      ? t / 0.1
      : t < 0.2
        ? 1 - ((t - 0.1) / 0.1) * 0.5
        : t < 0.3
          ? 0.5 - ((t - 0.2) / 0.1) * 0.5
          : 0;
  return { opacity: flash * layer.opacityMul, strokeWidth: size * layer.widthMul };
});

const SPARK_SAMPLERS: readonly DotSampler[] = SPARK_SEEDS.map((seed) => (t, size) => {
  const flash = t < 0.1 ? t / 0.1 : t < 0.25 ? 1 - (t - 0.1) / 0.15 : 0;
  const cx = size * 0.5 + seed.dx * size * flash;
  const cy = size * 0.5 + seed.dy * size * flash;
  return { cx, cy, r: size * 0.01 * flash, opacity: flash * 0.6 };
});

export const ThunderClapFlair = memo<FlairProps>(({ size }) => {
  const d = boltPath(size);
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {BOLT_LAYERS.map((layer, i) => (
        <LoopPath
          key={layer.color}
          sample={BOLT_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          d={d}
          stroke={layer.color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {SPARK_SEEDS.map((seed, i) => (
        <LoopDot
          key={`spark-${seed.dx}-${seed.dy}`}
          sample={SPARK_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,255,255)"
        />
      ))}
    </View>
  );
});
ThunderClapFlair.displayName = 'ThunderClapFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
