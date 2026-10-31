/**
 * FireRingFlair — Blazing Ring
 *
 * 8 flame particles orbit along the avatar edge with red→orange→yellow gradient and trails.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;
const N = 8;
const TRAIL = 3;
const COLORS = [
  [220, 40, 0],
  [240, 120, 0],
  [255, 180, 30],
  [220, 60, 0],
  [240, 100, 10],
  [255, 160, 20],
  [200, 30, 0],
  [240, 140, 0],
] as const;

/** Trail dots render back-to-front: `TRAIL … 0`, so the head is drawn last. */
const TRAIL_INDICES = Array.from({ length: TRAIL + 1 }, (_, i) => TRAIL - i);

/**
 * Flame `index` only shifts the orbit angle by `(index / N) * 2π`, i.e. by `index / N` of the
 * loop, so it is carried by `phase` and all flames share the same per-trail samplers.
 */
const FLAME_SEEDS = Array.from({ length: N }, (_, i) => ({
  index: i,
  phase: i / N,
}));

const TRAIL_SAMPLERS: readonly DotSampler[] = TRAIL_INDICES.map((trailIndex) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const orbit = size * 0.42;
  const r = size * 0.02;
  const baseAngle = t * Math.PI * 2;
  const trailAngle = baseAngle - trailIndex * 0.08;
  const x = cx + Math.cos(trailAngle) * orbit;
  const y = cy + Math.sin(trailAngle) * orbit;
  const alphaScale = trailIndex === 0 ? 1 : (1 - trailIndex / (TRAIL + 1)) * 0.5;
  const rScale = trailIndex === 0 ? 1 : 1 - trailIndex * 0.2;
  return { cx: x, cy: y, r: r * rScale, opacity: alphaScale * 0.75 };
});

function flameColor(index: number): string {
  const [cr, cg, cb] = COLORS[index % COLORS.length]!;
  return `rgb(${cr},${cg},${cb})`;
}

export const FireRingFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FLAME_SEEDS.map((seed) => (
      <Fragment key={`flame-${seed.phase}`}>
        {TRAIL_INDICES.map((trailIndex, i) => (
          <LoopDot
            key={`trail-${trailIndex}`}
            sample={TRAIL_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={flameColor(seed.index)}
          />
        ))}
      </Fragment>
    ))}
  </View>
));
FireRingFlair.displayName = 'FireRingFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
