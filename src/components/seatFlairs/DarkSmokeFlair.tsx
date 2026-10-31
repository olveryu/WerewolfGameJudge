/**
 * DarkSmokeFlair — Dark Smoke
 *
 * 5 dark-purple smoke wisps rise from the bottom in S-shaped paths at varying widths and opacity.
 * The rise + fade is a LoopLayer translation; the sideways sway bends the curve's control points,
 * which CSS cannot interpolate, so inside each layer the wisp is `WISP_VARIANTS` static curves
 * cross-faded by LoopMorph. The head puff is a LoopDot.
 */
import { Fragment, memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type DotSampler,
  type LayerSampler,
  LoopDot,
  LoopLayer,
  LoopMorph,
  type MorphSampler,
} from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const WISP_COUNT = 5;
/** Static curves per wisp; 8 across a 5 s loop keeps each cross-fade well under a second. */
const WISP_VARIANTS = 8;
/** Vertical travel per loop as a fraction of the tile (`y0 = size * (1 - t * 0.8)`). */
const RISE_FRAC = 0.8;
/** Gap between the wisp base and the SVG bottom edge so the round cap (≤ 0.0225 size) is not clipped. */
const CAP_PAD_FRAC = 0.05;

const WISP_SEEDS = Array.from({ length: WISP_COUNT }, (_, i) => ({
  xBase: 0.2 + (i * 0.6) / (WISP_COUNT - 1),
  phase: i / WISP_COUNT,
  drift: 0.05 + (i % 3) * 0.02,
  width: 0.03 + (i % 2) * 0.015,
}));

type WispSeed = (typeof WISP_SEEDS)[number];

/** Wisp curve at loop progress `t`, drawn with its base `CAP_PAD_FRAC` above the bottom of a `size` box. */
function wispPath(t: number, size: number, seed: WispSeed): string {
  const base = size * seed.xBase;
  const y0 = size - size * CAP_PAD_FRAC;
  const y1 = y0 - size * 0.15;
  const y2 = y1 - size * 0.15;
  const y3 = y2 - size * 0.15;
  const dx = seed.drift * size * Math.sin(t * Math.PI * 3);
  return `M ${base} ${y0} Q ${base + dx} ${y1} ${base - dx * 0.5} ${y2} Q ${base + dx * 0.3} ${y3 + size * 0.05} ${base} ${y3}`;
}

/** Rise + fade of the wisp box; the in-box base lands on the original `y0 = size * (1 - t * 0.8)`. */
const riseSampler: LayerSampler = (t, size) => {
  const alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
  return {
    x: size / 2,
    y: size / 2 - t * RISE_FRAC * size + size * CAP_PAD_FRAC,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: alpha * 0.25,
  };
};

/** The fade lives on the enclosing LoopLayer, so the morph itself is fully opaque. */
const opaqueSampler: MorphSampler = () => ({ opacity: 1 });

const HEAD_SAMPLERS: readonly DotSampler[] = WISP_SEEDS.map((seed) => (t, size) => {
  const base = size * seed.xBase;
  const y = size * (1 - t * 0.8) - size * 0.45;
  const dx = seed.drift * size * Math.sin(t * Math.PI * 3) * 0.3;
  const alpha = t < 0.2 ? 0 : t > 0.8 ? (1 - t) / 0.2 : 0.35;
  return { cx: base + dx, cy: y, r: seed.width * size * 0.8, opacity: alpha };
});

/** Rising, fading wisp box holding the cross-faded sway variants. */
const WispBody = memo<{ seed: WispSeed; size: number }>(({ seed, size }) => {
  const renderVariant = useCallback(
    (k: number, s: number) => (
      <Svg width={s} height={s}>
        <Path
          d={wispPath(k / WISP_VARIANTS, s, seed)}
          stroke="rgb(80,60,100)"
          strokeWidth={seed.width * s}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    ),
    [seed],
  );
  return (
    <LoopLayer
      sample={riseSampler}
      size={size}
      durationMs={LOOP_MS}
      phase={seed.phase}
      width={size}
      height={size}
    >
      <LoopMorph
        sample={opaqueSampler}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        variantCount={WISP_VARIANTS}
        mode="crossfade"
        renderVariant={renderVariant}
      />
    </LoopLayer>
  );
});
WispBody.displayName = 'WispBody';

export const DarkSmokeFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WISP_SEEDS.map((seed, i) => (
      <Fragment key={`wisp-${seed.xBase}`}>
        <WispBody seed={seed} size={size} />
        <LoopDot
          sample={HEAD_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(60,40,80)"
        />
      </Fragment>
    ))}
  </View>
));
DarkSmokeFlair.displayName = 'DarkSmokeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
