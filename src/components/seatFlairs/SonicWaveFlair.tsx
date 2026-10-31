/**
 * SonicWaveFlair - sonic wave oscillation
 *
 * 5 teal sound wave rings pulse outward from the center with frequency-modulated jitter.
 *
 * The jitter `sin(a * 8 + t * π * 12 + index * 2)` is an 8-lobed shape rotating by -1.5π per loop
 * (six lobe periods, so the loop closes), and the ring growth is a uniform scale about the centre, so
 * each ring is a static wobbly circle at the maximum radius inside a LoopLayer. Because a layer scale
 * also scales the stroke, the original independent stroke-width breathing is approximated by two
 * stacked copies (thin / thick) cross-faded so the blended stroke tracks the original width.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const WAVE_COUNT = 5;
const SEGS = 48;
const RAD_TO_DEG = 180 / Math.PI;
const STROKE_COLOR = 'rgb(80,200,180)';
/** Ring radius sweeps `size * 0.12 → size * 0.48` over one wave cycle. */
const R_MIN_FRAC = 0.12;
const R_SPAN_FRAC = 0.36;
/** The static ring is drawn at the largest radius (wave cycle end), so the layer scale is ≤ 1. */
const BASE_R_FRAC = R_MIN_FRAC + R_SPAN_FRAC;
/** Layer box as a multiple of tile size; covers the ±6 % wobble at `BASE_R_FRAC` plus the thick stroke. */
const BOX_FACTOR = 1.2;

const INDICES = Array.from({ length: WAVE_COUNT }, (_, i) => i);

function radiusAt(wt: number, size: number): number {
  return size * R_MIN_FRAC + wt * size * R_SPAN_FRAC;
}

function strokeAt(wt: number): number {
  return 1.5 * (1 - wt * 0.5);
}

/** Static strokes that, once multiplied by the layer scale, equal the original width at wt = 1 / wt = 0. */
const THIN_STROKE = strokeAt(1) / (radiusAt(1, 1) / BASE_R_FRAC);
const THICK_STROKE = strokeAt(0) / (radiusAt(0, 1) / BASE_R_FRAC);

interface WaveState {
  scale: number;
  rotateDeg: number;
  alpha: number;
  /** Weight of the thick copy so `thin * (1 - w) + thick * w` matches the original stroke width. */
  thickWeight: number;
}

function waveState(t: number, index: number, size: number): WaveState {
  const wt = (t * 1.2 + index / WAVE_COUNT) % 1;
  const radius = radiusAt(wt, size);
  const alpha = (1 - wt) * 0.55;
  const sw = strokeAt(wt);
  const scale = radius / (size * BASE_R_FRAC);
  const thinEff = THIN_STROKE * scale;
  const thickEff = THICK_STROKE * scale;
  const thickWeight = Math.min(1, Math.max(0, (sw - thinEff) / (thickEff - thinEff)));
  return {
    scale,
    rotateDeg: -((t * Math.PI * 12) / 8) * RAD_TO_DEG,
    alpha,
    thickWeight,
  };
}

function createWaveSampler(index: number, weightOf: (state: WaveState) => number): LayerSampler {
  return (t, size) => {
    const state = waveState(t, index, size);
    return {
      x: size / 2,
      y: size / 2,
      rotateDeg: state.rotateDeg,
      scaleX: state.scale,
      scaleY: state.scale,
      opacity: state.alpha * weightOf(state),
    };
  };
}

const THIN_SAMPLERS: readonly LayerSampler[] = INDICES.map((index) =>
  createWaveSampler(index, (state) => 1 - state.thickWeight),
);
const THICK_SAMPLERS: readonly LayerSampler[] = INDICES.map((index) =>
  createWaveSampler(index, (state) => state.thickWeight),
);

/** Wobbly ring at `t = 0` and `BASE_R_FRAC`, centred on the origin. */
function wavePath(index: number, size: number): string {
  const radius = size * BASE_R_FRAC;
  let d = '';
  for (let s = 0; s <= SEGS; s++) {
    const a = (s / SEGS) * Math.PI * 2;
    const w = 1 + 0.06 * Math.sin(a * 8 + index * 2);
    const x = Math.cos(a) * radius * w;
    const y = Math.sin(a) * radius * w;
    d += s === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  d += ' Z';
  return d;
}

function WaveArt({
  index,
  size,
  strokeWidth,
}: {
  index: number;
  size: number;
  strokeWidth: number;
}) {
  const box = size * BOX_FACTOR;
  const half = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Path d={wavePath(index, size)} stroke={STROKE_COLOR} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export const SonicWaveFlair = memo<FlairProps>(({ size }) => {
  const box = size * BOX_FACTOR;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {INDICES.map((index) => (
        <Fragment key={`wave-${index}`}>
          <LoopLayer
            sample={THIN_SAMPLERS[index]!}
            size={size}
            durationMs={LOOP_MS}
            width={box}
            height={box}
          >
            <WaveArt index={index} size={size} strokeWidth={THIN_STROKE} />
          </LoopLayer>
          <LoopLayer
            sample={THICK_SAMPLERS[index]!}
            size={size}
            durationMs={LOOP_MS}
            width={box}
            height={box}
          >
            <WaveArt index={index} size={size} strokeWidth={THICK_STROKE} />
          </LoopLayer>
        </Fragment>
      ))}
    </View>
  );
});
SonicWaveFlair.displayName = 'SonicWaveFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
