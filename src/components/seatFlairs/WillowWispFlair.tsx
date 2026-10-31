/**
 * WillowWispFlair — willow wisp flair
 *
 * 6 wisps drift around the avatar: slow Lissajous paths + random flicker.
 * Each wisp = outer halo + bright core.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const WISP_COUNT = 6;
const COLORS = [
  [100, 255, 180],
  [80, 240, 160],
  [120, 255, 200],
  [90, 230, 170],
  [110, 250, 190],
  [80, 220, 155],
] as const;

const WISP_SEEDS = Array.from({ length: WISP_COUNT }, (_, i) => ({
  ax: 0.2 + (i % 3) * 0.08,
  ay: 0.15 + (i % 4) * 0.06,
  bx: i * 1.1,
  by: i * 0.7,
  freqX: 1 + (i % 2) * 0.5,
  freqY: 0.8 + (i % 3) * 0.3,
  phase: i / WISP_COUNT,
  ci: i % COLORS.length,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

function wispPosition(t: number, size: number, seed: WispSeed): { x: number; y: number } {
  const cx = size / 2;
  const cy = size / 2;
  return {
    x: cx + Math.sin(t * Math.PI * 2 * seed.freqX) * seed.ax * size,
    y: cy + Math.cos(t * Math.PI * 2 * seed.freqY + seed.bx) * seed.ay * size,
  };
}

const HALO_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const { x, y } = wispPosition(t, size, seed);
  const flicker = 0.4 + Math.sin(t * Math.PI * 6 + seed.by) * 0.25;
  return { cx: x, cy: y, r: size * 0.025, opacity: flicker * 0.3 };
});

const CORE_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const { x, y } = wispPosition(t, size, seed);
  const flicker = 0.5 + Math.sin(t * Math.PI * 6 + seed.by) * 0.3;
  return { cx: x, cy: y, r: size * 0.008, opacity: flicker };
});

function wispColor(seed: WispSeed): string {
  const [cr, cg, cb] = COLORS[seed.ci]!;
  return `rgb(${cr},${cg},${cb})`;
}

export const WillowWispFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WISP_SEEDS.map((seed, i) => (
      <Fragment key={`wisp-${seed.bx}`}>
        <LoopDot
          sample={HALO_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color={wispColor(seed)}
        />
        <LoopDot
          sample={CORE_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(220,255,240)"
        />
      </Fragment>
    ))}
  </View>
));
WillowWispFlair.displayName = 'WillowWispFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
