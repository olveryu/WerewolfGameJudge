/**
 * TidePoolFlair — Tide Pool
 *
 * Ripple rings expanding from random positions: 5 ripple sources fire at different times,
 * each producing 3 concentric rings that expand and fade.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoopRing, type RingSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const RINGS_PER_RIPPLE = 3;

const RIPPLE_SEEDS = [
  { cx: 0.25, cy: 0.3, phase: 0 },
  { cx: 0.7, cy: 0.2, phase: 0.2 },
  { cx: 0.5, cy: 0.6, phase: 0.45 },
  { cx: 0.15, cy: 0.75, phase: 0.6 },
  { cx: 0.8, cy: 0.8, phase: 0.8 },
] as const;

type RippleSeed = (typeof RIPPLE_SEEDS)[number];

const RING_INDICES = Array.from({ length: RINGS_PER_RIPPLE }, (_, i) => i);

function createRingSampler(seed: RippleSeed, ri: number): RingSampler {
  const ringDelay = ri * 0.1;
  return (t, size) => {
    const localT = Math.max(0, t - ringDelay);
    const expansion = localT / (1 - ringDelay);
    const r = expansion * size * 0.12;
    const alpha = expansion < 0.05 ? expansion / 0.05 : (1 - expansion) * 0.2;
    return {
      cx: seed.cx * size,
      cy: seed.cy * size,
      r: Math.max(0, r),
      strokeWidth: size * (0.004 - ri * 0.001),
      opacity: Math.max(0, alpha),
    };
  };
}

const RING_SAMPLERS: readonly (readonly RingSampler[])[] = RIPPLE_SEEDS.map((seed) =>
  RING_INDICES.map((ri) => createRingSampler(seed, ri)),
);

export const TidePoolFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {RIPPLE_SEEDS.map((seed, i) => (
      <Fragment key={`ripple-${seed.cx}-${seed.cy}`}>
        {RING_SAMPLERS[i]!.map((sampler, ri) => (
          <LoopRing
            key={`ring-${ri}`}
            sample={sampler}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(100,180,220)"
          />
        ))}
      </Fragment>
    ))}
  </View>
));
TidePoolFlair.displayName = 'TidePoolFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
