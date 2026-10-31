/**
 * EclipseRingFlair — Eclipse Ring
 *
 * Pulsing eclipse halo: a ring with a dark inside and bright outside breathes around the avatar edge,
 * with 3 concentric arcs (varying thickness/tone) + edge sparks.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot, LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const SPARK_COUNT = 5;

const CORONA_LAYERS = [
  { color: 'rgb(255,120,40)', rOff: 0.04, widthMul: 0.03, opMul: 0.15 },
  { color: 'rgb(255,180,80)', rOff: 0.02, widthMul: 0.015, opMul: 0.25 },
  { color: 'rgb(255,240,200)', rOff: 0, widthMul: 0.005, opMul: 0.4 },
] as const;

const SPARK_SEEDS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  angle: (i / SPARK_COUNT) * Math.PI * 2,
  phase: i / SPARK_COUNT,
}));

const CORONA_SAMPLERS: readonly RingSampler[] = CORONA_LAYERS.map((layer) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
  const r = size * (0.42 + layer.rOff) * pulse;
  return { cx, cy, r, opacity: layer.opMul * pulse, strokeWidth: size * layer.widthMul };
});

const SPARK_SAMPLERS: readonly DotSampler[] = SPARK_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const pulse = 0.8 + Math.sin(t * Math.PI * 2) * 0.2;
  const r = size * 0.46 * pulse;
  const angle = seed.angle + t * 0.5;
  const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.6);
  return {
    cx: cx + Math.cos(angle) * r,
    cy: cy + Math.sin(angle) * r,
    r: size * 0.008,
    opacity: alpha,
  };
});

export const EclipseRingFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {CORONA_LAYERS.map((layer, i) => (
      <LoopRing
        key={layer.color}
        sample={CORONA_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        color={layer.color}
      />
    ))}
    {SPARK_SEEDS.map((seed, i) => (
      <LoopDot
        key={`spark-${seed.phase}`}
        sample={SPARK_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        color="rgb(255,200,80)"
      />
    ))}
  </View>
));
EclipseRingFlair.displayName = 'EclipseRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
