/**
 * ShadowClawFlair — Shadow Claw
 *
 * 4 sets of three purple claw marks slash inward from corners, with pulse animation and tip sparks.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const SCRATCH_COUNT = 3;

/** Corner origins as tile fractions; `ci` is the per-corner pulse offset index. */
const CLAW_SEEDS = [
  { oxFrac: 0.05, oyFrac: 0.05, dx: 1, dy: 1, ci: 0 },
  { oxFrac: 0.95, oyFrac: 0.05, dx: -1, dy: 1, ci: 1 },
  { oxFrac: 0.05, oyFrac: 0.95, dx: 1, dy: -1, ci: 2 },
  { oxFrac: 0.95, oyFrac: 0.95, dx: -1, dy: -1, ci: 3 },
] as const;

type ClawSeed = (typeof CLAW_SEEDS)[number];

function clawPulse(t: number, seed: ClawSeed): number {
  return 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + seed.ci * 0.8) * Math.PI));
}

function createScratchSampler(seed: ClawSeed, k: number): LineSampler {
  return (t, size) => {
    const pulse = clawPulse(t, seed);
    const offset = (k - 1) * size * 0.03;
    const sx = seed.oxFrac * size + seed.dy * offset;
    const sy = seed.oyFrac * size + -seed.dx * offset;
    const len = size * 0.18 * pulse;
    const ex = sx + seed.dx * len;
    const ey = sy + seed.dy * len;
    return {
      x1: sx,
      y1: sy,
      x2: ex,
      y2: ey,
      opacity: pulse * (0.6 - k * 0.1),
      strokeWidth: 2 - k * 0.4,
    };
  };
}

const SCRATCH_SAMPLERS: readonly (readonly LineSampler[])[] = CLAW_SEEDS.map((seed) =>
  Array.from({ length: SCRATCH_COUNT }, (_, k) => createScratchSampler(seed, k)),
);

const SPARK_SAMPLERS: readonly DotSampler[] = CLAW_SEEDS.map((seed) => (t, size) => {
  const pulse = clawPulse(t, seed);
  const tipX = seed.oxFrac * size + seed.dx * size * 0.18 * pulse;
  const tipY = seed.oyFrac * size + seed.dy * size * 0.18 * pulse;
  return { cx: tipX, cy: tipY, r: size * 0.012, opacity: pulse * 0.6 };
});

export const ShadowClawFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {CLAW_SEEDS.map((seed, i) => (
      <Fragment key={`claw-${seed.oxFrac}-${seed.oyFrac}`}>
        {SCRATCH_SAMPLERS[i]!.map((sampler, k) => (
          <LoopLine
            key={`scratch-${k}`}
            sample={sampler}
            size={size}
            durationMs={LOOP_MS}
            color="rgb(120,40,160)"
          />
        ))}
        <LoopDot
          sample={SPARK_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(180,100,220)"
        />
      </Fragment>
    ))}
  </View>
));
ShadowClawFlair.displayName = 'ShadowClawFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
