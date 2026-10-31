/**
 * SilverStreamFlair — Silver Stream
 *
 * 2 silver liquid streams flow downward from both top sides along the edges, path arcs + shimmer particles.
 *
 * The stream arc grows and wobbles as a path-data morph, which CSS animations cannot interpolate,
 * so each stream is rendered as `STREAM_VARIANTS` static curves cross-faded by `LoopMorph`.
 */
import { Fragment, memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, LoopDot, LoopMorph, type MorphSampler } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
/** Static curves per stream; 8 across a 4 s loop keeps each cross-fade at half a second. */
const STREAM_VARIANTS = 8;
const GLEAM_PER_STREAM = 3;

type StreamSide = 'left' | 'right';

const STREAM_SEEDS: readonly { side: StreamSide; phase: number }[] = [
  { side: 'left', phase: 0 },
  { side: 'right', phase: 0.3 },
];

const GLEAM_SEEDS = Array.from({ length: GLEAM_PER_STREAM }, (_, i) => ({
  idx: i,
  frac: 0.2 + (i / (GLEAM_PER_STREAM - 1)) * 0.6,
}));

function edgeX(side: StreamSide, size: number): number {
  return side === 'left' ? size * 0.08 : size * 0.92;
}

function midX(side: StreamSide, size: number): number {
  return side === 'left' ? size * 0.06 : size * 0.94;
}

function streamPath(side: StreamSide, t: number, size: number): string {
  const xEdge = edgeX(side, size);
  const xMid = midX(side, size);
  const flowLen = t * size * 1.0;
  const y0 = 0;
  const y1 = Math.min(size * 0.35, flowLen);
  const y2 = Math.min(size * 0.7, flowLen);
  const y3 = Math.min(size, flowLen);
  const wobble = Math.sin(t * Math.PI * 4) * size * 0.015;
  return `M ${xEdge} ${y0} Q ${xMid + wobble} ${y1} ${xEdge - wobble} ${y2} Q ${xMid + wobble * 0.5} ${(y2 + y3) / 2} ${xEdge} ${y3}`;
}

const streamSampler: MorphSampler = (t) => {
  const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.25;
  return { opacity: alpha };
};

function renderStreamVariant(side: StreamSide, k: number, size: number): ReactNode {
  return (
    <Svg width={size} height={size}>
      <Path
        d={streamPath(side, k / STREAM_VARIANTS, size)}
        stroke="rgb(200,210,220)"
        fill="none"
        strokeLinecap="round"
        strokeWidth={size * 0.012}
      />
    </Svg>
  );
}

const STREAM_RENDERERS: readonly ((k: number, size: number) => ReactNode)[] = STREAM_SEEDS.map(
  (seed) => (k, size) => renderStreamVariant(seed.side, k, size),
);

function createGleamSampler(side: StreamSide, idx: number, frac: number): DotSampler {
  return (t, size) => {
    const xEdge = edgeX(side, size);
    const flowLen = t * size * 1.0;
    const gy = frac * flowLen;
    const visible = gy > 0 && gy < size;
    return {
      cx: xEdge + Math.sin(t * Math.PI * 6 + idx) * size * 0.01,
      cy: gy,
      r: size * 0.006,
      opacity: visible ? 0.5 + Math.sin(t * Math.PI * 8 + idx * 2) * 0.3 : 0,
    };
  };
}

const GLEAM_SAMPLERS: readonly (readonly DotSampler[])[] = STREAM_SEEDS.map((seed) =>
  GLEAM_SEEDS.map((gleam) => createGleamSampler(seed.side, gleam.idx, gleam.frac)),
);

export const SilverStreamFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {STREAM_SEEDS.map((seed, i) => (
      <Fragment key={`stream-${seed.side}`}>
        <LoopMorph
          sample={streamSampler}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          variantCount={STREAM_VARIANTS}
          mode="crossfade"
          renderVariant={STREAM_RENDERERS[i]!}
        />
        {GLEAM_SEEDS.map((gleam, g) => (
          <LoopDot
            key={`gleam-${gleam.frac}`}
            sample={GLEAM_SAMPLERS[i]![g]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(240,245,255)"
          />
        ))}
      </Fragment>
    ))}
  </View>
));
SilverStreamFlair.displayName = 'SilverStreamFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
