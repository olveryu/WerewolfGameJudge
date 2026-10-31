/**
 * OceanWaveFlair — Ocean Surge
 *
 * 3 horizontal sine waves surge upward from bottom with different phases/amplitudes, with crest splash
 * particles. Each wave is `sin(x · π · freq / size + 4π t)`: a travelling wave, so its time evolution is a
 * pure translation (left by `4 size / freq` per loop, up by `0.05 size`) of one static polyline that is
 * drawn `1 + 4 / freq` tiles wide and slides under an `overflow: hidden` wrapper.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const WAVE_COUNT = 3;
/** Polyline vertices per tile width (the original `steps`). */
const STEPS_PER_TILE = 8;
/** Temporal angular speed of the wave, in radians per loop (`t * Math.PI * 4`). */
const WAVE_OMEGA = Math.PI * 4;

const WAVE_SEEDS = Array.from({ length: WAVE_COUNT }, (_, i) => ({
  yBase: 0.75 + i * 0.08,
  amplitude: 0.03 + i * 0.01,
  phase: i / WAVE_COUNT,
  freq: 2 + i,
}));

type WaveSeed = (typeof WAVE_SEEDS)[number];

/** `sin(k x + ω t)` travels toward −x by `ω t / k`; `k = π freq / size`, so one loop covers `4 / freq` tiles. */
function travelTiles(seed: WaveSeed): number {
  return WAVE_OMEGA / (Math.PI * seed.freq);
}

/** Curve width in tiles: one visible tile plus the full travel. */
function curveWidthFactor(seed: WaveSeed): number {
  return 1 + travelTiles(seed);
}

/** Static wave at `t = 0`, drawn across `curveWidthFactor` tiles with the original vertex density. */
function wavePath(seed: WaveSeed, size: number): string {
  const yOff = seed.yBase * size;
  const width = size * curveWidthFactor(seed);
  const steps = Math.ceil(STEPS_PER_TILE * curveWidthFactor(seed));
  let d = `M 0 ${yOff}`;
  for (let s = 1; s <= steps; s++) {
    const x = (s / steps) * width;
    const y = yOff + Math.sin((x / size) * Math.PI * seed.freq) * seed.amplitude * size;
    d += ` L ${x} ${y}`;
  }
  return d;
}

const WAVE_SAMPLERS: readonly LayerSampler[] = WAVE_SEEDS.map((seed) => (t, size) => {
  const shift = t * travelTiles(seed) * size;
  const alpha = 0.15 + Math.sin(t * Math.PI * 2) * 0.05;
  return {
    x: (size * curveWidthFactor(seed)) / 2 - shift,
    y: size / 2 - t * size * 0.05,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: alpha,
  };
});

const CREST_SAMPLERS: readonly DotSampler[] = WAVE_SEEDS.map((seed) => (t, size) => {
  const peakX = size * (0.3 + t * 0.4);
  const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size;
  const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.4);
  return { cx: peakX, cy: peakY, r: size * 0.012, opacity: alpha };
});

const SPRAY_SAMPLERS: readonly DotSampler[] = WAVE_SEEDS.map((seed) => (t, size) => {
  const peakX = size * (0.3 + t * 0.4) + size * 0.03;
  const peakY = seed.yBase * size - t * size * 0.05 - seed.amplitude * size - size * 0.02;
  const alpha = Math.max(0, Math.sin(t * Math.PI * 4) * 0.25);
  return { cx: peakX, cy: peakY, r: size * 0.006, opacity: alpha };
});

export const OceanWaveFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WAVE_SEEDS.map((seed, i) => {
      const width = size * curveWidthFactor(seed);
      return (
        <Fragment key={`wave-${seed.yBase}`}>
          <LoopLayer
            sample={WAVE_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={width}
            height={size}
          >
            <Svg width={width} height={size}>
              <Path
                d={wavePath(seed, size)}
                stroke="rgb(60,140,200)"
                strokeWidth={size * 0.015}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </LoopLayer>
          <LoopDot
            sample={CREST_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(180,220,255)"
          />
          <LoopDot
            sample={SPRAY_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(220,240,255)"
          />
        </Fragment>
      );
    })}
  </View>
));
OceanWaveFlair.displayName = 'OceanWaveFlair';

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 1,
    overflow: 'hidden',
  },
});
