/**
 * ThunderBoltFlair — Thunder Flash
 *
 * 6 short jagged lightning bolts strike outward from avatar edge, flashing in turn
 * (flash→afterglow→fade). Bolt geometry is fixed per seed; only intensity animates.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot, LoopPath, type PathSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const BOLT_COUNT = 6;
const SEGS = 4;

const BOLT_SEEDS = Array.from({ length: BOLT_COUNT }, (_, i) => ({
  angle: (i / BOLT_COUNT) * Math.PI * 2 - Math.PI / 2,
  offsets: Array.from(
    { length: SEGS + 1 },
    (_, s) => (s % 2 === 0 ? 1 : -1) * (0.03 + ((i * 7 + s * 3) % 5) * 0.012),
  ),
  phase: i / BOLT_COUNT,
}));

type BoltSeed = (typeof BOLT_SEEDS)[number];

/** Flash in over 15 % of the loop, decay to zero by 40 %, dark for the rest. */
function intensityAt(t: number): number {
  if (t < 0.15) return t / 0.15;
  if (t < 0.4) return 1 - (t - 0.15) / 0.25;
  return 0;
}

function boltPoints(seed: BoltSeed, size: number): { x: number; y: number }[] {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.38;
  const outerR = size * 0.52;
  const cosA = Math.cos(seed.angle);
  const sinA = Math.sin(seed.angle);
  const perpX = -sinA;
  const perpY = cosA;
  return Array.from({ length: SEGS + 1 }, (_, s) => {
    const r = innerR + (s / SEGS) * (outerR - innerR);
    const lateralOff = seed.offsets[s]! * size;
    return { x: cx + cosA * r + perpX * lateralOff, y: cy + sinA * r + perpY * lateralOff };
  });
}

function boltPath(seed: BoltSeed, size: number): string {
  return boltPoints(seed, size)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

const LAYERS = [
  { stroke: 'rgb(80,160,255)', widthFrac: 0.05, alpha: 0.25 },
  { stroke: 'rgb(140,200,255)', widthFrac: 0.025, alpha: 0.5 },
  { stroke: 'rgb(220,240,255)', widthFrac: 0.012, alpha: 0.9 },
] as const;

const LAYER_SAMPLERS: readonly PathSampler[] = LAYERS.map((layer) => (t, size) => {
  const intensity = intensityAt(t);
  return {
    strokeWidth: size * layer.widthFrac,
    opacity: intensity < 0.01 ? 0 : intensity * layer.alpha,
  };
});

const SPARK_SAMPLERS: readonly DotSampler[] = BOLT_SEEDS.map((seed) => (t, size) => {
  const intensity = intensityAt(t);
  const tip = boltPoints(seed, size)[SEGS]!;
  return {
    cx: tip.x,
    cy: tip.y,
    r: intensity < 0.01 ? 0 : size * 0.015 * intensity,
    opacity: intensity < 0.01 ? 0 : intensity * 0.7,
  };
});

export const ThunderBoltFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BOLT_SEEDS.map((seed, i) => {
      const d = boltPath(seed, size);
      return (
        <Fragment key={`bolt-${seed.phase}`}>
          {LAYERS.map((layer, l) => (
            <LoopPath
              key={layer.stroke}
              sample={LAYER_SAMPLERS[l]!}
              size={size}
              durationMs={LOOP_MS}
              phase={seed.phase}
              d={d}
              stroke={layer.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <LoopDot
            sample={SPARK_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(255,255,255)"
          />
        </Fragment>
      );
    })}
  </View>
));
ThunderBoltFlair.displayName = 'ThunderBoltFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
