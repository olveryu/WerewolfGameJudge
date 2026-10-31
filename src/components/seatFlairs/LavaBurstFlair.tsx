/**
 * LavaBurstFlair — lava burst
 *
 * 5 lava blobs erupt from the bottom on parabolic trajectories with gravity fall and spark trails (3 trail circles).
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const BLOB_COUNT = 5;
const COLORS = [
  [255, 80, 0],
  [255, 120, 20],
  [255, 60, 10],
  [255, 100, 0],
  [255, 140, 40],
] as const;

const BLOB_SEEDS = Array.from({ length: BLOB_COUNT }, (_, i) => ({
  xBase: 0.3 + (i * 0.4) / (BLOB_COUNT - 1),
  vx: (i % 2 === 0 ? 1 : -1) * (0.05 + i * 0.02),
  vy: 0.8 + (i % 3) * 0.15,
  phase: i / BLOB_COUNT,
  rFrac: 0.02 + (i % 3) * 0.006,
  ci: i % COLORS.length,
}));

type BlobSeed = (typeof BLOB_SEEDS)[number];

/** Trail circles lag the blob by `lag` of the loop and shrink / dim per step (drawn back to front). */
const TRAILS = [
  { lag: 0.12, rScale: 0.2, opacity: 0.1 },
  { lag: 0.08, rScale: 0.35, opacity: 0.2 },
  { lag: 0.04, rScale: 0.6, opacity: 0.4 },
] as const;

function getPos(seed: BlobSeed, size: number, t: number): { x: number; y: number } {
  const gravity = size * 1.2;
  const x = seed.xBase * size + seed.vx * size * t;
  const y = size - (seed.vy * size * t - 0.5 * gravity * t * t);
  return { x, y };
}

const MAIN_SAMPLERS: readonly DotSampler[] = BLOB_SEEDS.map((seed) => (t, size) => {
  const { x, y } = getPos(seed, size, t);
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.8;
  return { cx: x, cy: y, r: seed.rFrac * size, opacity: alpha };
});

const TRAIL_SAMPLERS: readonly (readonly DotSampler[])[] = BLOB_SEEDS.map((seed) =>
  TRAILS.map(
    (trail): DotSampler =>
      (t, size) => {
        const { x, y } = getPos(seed, size, Math.max(0, t - trail.lag));
        return { cx: x, cy: y, r: seed.rFrac * size * trail.rScale, opacity: trail.opacity };
      },
  ),
);

export const LavaBurstFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {BLOB_SEEDS.map((seed, i) => {
      const [cr, cg, cb] = COLORS[seed.ci]!;
      const color = `rgb(${cr},${cg},${cb})`;
      return (
        <Fragment key={`blob-${seed.xBase}`}>
          {TRAIL_SAMPLERS[i]!.map((sampler, k) => (
            <LoopDot
              key={`trail-${TRAILS[k]!.lag}`}
              sample={sampler}
              size={size}
              durationMs={LOOP_MS}
              phase={seed.phase}
              color={color}
            />
          ))}
          <LoopDot
            sample={MAIN_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color={color}
          />
        </Fragment>
      );
    })}
  </View>
));
LavaBurstFlair.displayName = 'LavaBurstFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
