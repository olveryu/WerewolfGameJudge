/**
 * ThornVineFlair — thorny vines wrap
 *
 * 4 thorny vines grow from the corners toward the center with thorn particles. The growing vine is
 * the full quadratic curve with every point scaled about its start corner by `growFrac`, so it is a
 * static path inside a LoopLayer centred on that corner and scaled by the sampler.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;

const VINE_SEEDS = [
  { startX: 0, startY: 0, ctrlX: 0.3, ctrlY: 0.2, endX: 0.45, endY: 0.45, phase: 0 },
  { startX: 1, startY: 0, ctrlX: 0.7, ctrlY: 0.25, endX: 0.55, endY: 0.45, phase: 0.25 },
  { startX: 0, startY: 1, ctrlX: 0.25, ctrlY: 0.7, endX: 0.45, endY: 0.55, phase: 0.5 },
  { startX: 1, startY: 1, ctrlX: 0.75, ctrlY: 0.75, endX: 0.55, endY: 0.55, phase: 0.75 },
] as const;

type VineSeed = (typeof VINE_SEEDS)[number];

/** Fully grown vine (`growFrac = 1`) in tile pixel space. */
function vinePath(seed: VineSeed, size: number): string {
  const sx = seed.startX * size;
  const sy = seed.startY * size;
  const mx = seed.ctrlX * size;
  const my = seed.ctrlY * size;
  const ex = seed.endX * size;
  const ey = seed.endY * size;
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
}

const VINE_SAMPLERS: readonly LayerSampler[] = VINE_SEEDS.map((seed) => (t, size) => {
  const growFrac = Math.min(t * 2, 1);
  const alpha = t > 0.7 ? (1 - t) / 0.3 : 0.4;
  return {
    x: seed.startX * size,
    y: seed.startY * size,
    rotateDeg: 0,
    scaleX: growFrac,
    scaleY: growFrac,
    opacity: alpha,
  };
});

const THORN_SAMPLERS: readonly DotSampler[] = VINE_SEEDS.map((seed) => (t, size) => {
  const growFrac = Math.min(t * 2, 1);
  const midX = seed.startX * size + (seed.ctrlX * size - seed.startX * size) * growFrac * 0.5;
  const midY = seed.startY * size + (seed.ctrlY * size - seed.startY * size) * growFrac * 0.5;
  const alpha = growFrac > 0.3 ? (t > 0.7 ? (1 - t) / 0.3 : 0.5) : 0;
  return { cx: midX, cy: midY - size * 0.02, r: size * 0.008, opacity: alpha };
});

const TIP_SAMPLERS: readonly DotSampler[] = VINE_SEEDS.map((seed) => (t, size) => {
  const growFrac = Math.min(t * 2, 1);
  const ex = seed.startX * size + (seed.endX * size - seed.startX * size) * growFrac;
  const ey = seed.startY * size + (seed.endY * size - seed.startY * size) * growFrac;
  const alpha = growFrac > 0.5 ? (t > 0.7 ? (1 - t) / 0.3 : 0.6) : 0;
  return { cx: ex, cy: ey, r: size * 0.01, opacity: alpha };
});

export const ThornVineFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {VINE_SEEDS.map((seed, i) => {
      const sx = seed.startX * size;
      const sy = seed.startY * size;
      return (
        <Fragment key={`vine-${seed.startX}-${seed.startY}`}>
          <LoopLayer
            sample={VINE_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={size}
            height={size}
          >
            <Svg
              width={size}
              height={size}
              viewBox={`${sx - size / 2} ${sy - size / 2} ${size} ${size}`}
            >
              <Path
                d={vinePath(seed, size)}
                stroke="rgb(60,80,40)"
                strokeWidth={size * 0.012}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </LoopLayer>
          <LoopDot
            sample={THORN_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(100,60,30)"
          />
          <LoopDot
            sample={TIP_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(80,100,50)"
          />
        </Fragment>
      );
    })}
  </View>
));
ThornVineFlair.displayName = 'ThornVineFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
