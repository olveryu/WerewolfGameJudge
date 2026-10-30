/**
 * MirageHeatFlair — Mirage Heat
 *
 * 6 faint horizontal heat waves shimmer across the seat. Each wave is a travelling sine with two
 * spatial periods per tile width, so its time evolution is a pure horizontal translation: a static
 * 1.5-tile-wide curve slides left under an `overflow: hidden` wrapper.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4000;
const WAVE_COUNT = 6;
/** Spatial periods across one tile width (the original path used `Math.PI * 4` over `size`). */
const SPATIAL_PERIODS = 2;
/** Curve width as a multiple of tile size; covers the largest translation (0.75 tiles). */
const CURVE_WIDTH_FACTOR = 1.5;
const SEGMENTS_PER_TILE = 6;
const STROKE_COLOR = 'rgb(200,180,140)';

const WAVE_SEEDS = Array.from({ length: WAVE_COUNT }, (_, i) => ({
  yFrac: 0.15 + (i * 0.7) / (WAVE_COUNT - 1),
  amplitude: 0.01 + (i % 3) * 0.005,
  freq: 1 + (i % 2) * 0.5,
  phase: i / WAVE_COUNT,
}));

type WaveSeed = (typeof WAVE_SEEDS)[number];

/** Static wave at `t = 0`, drawn across `CURVE_WIDTH_FACTOR` tiles with the original Q-segment density. */
function wavePath(seed: WaveSeed, size: number): string {
  const baseY = seed.yFrac * size;
  const amp = seed.amplitude * size;
  const segments = SEGMENTS_PER_TILE * CURVE_WIDTH_FACTOR;
  const width = size * CURVE_WIDTH_FACTOR;
  const k = (Math.PI * 2 * SPATIAL_PERIODS) / size;
  let d = `M 0 ${baseY}`;
  for (let i = 1; i <= segments; i += 1) {
    const sx = (i / segments) * width;
    const cpx = ((i - 0.5) / segments) * width;
    d += ` Q ${cpx} ${baseY + Math.sin(k * cpx) * amp * 1.2} ${sx} ${baseY + Math.sin(k * sx) * amp}`;
  }
  return d;
}

/** sin(ωt + kx) travels toward −x by ωt / k; the box centre starts at 0.75 tiles. */
const WAVE_SAMPLERS: readonly LayerSampler[] = WAVE_SEEDS.map((seed) => (t, size) => {
  const shift = (t * seed.freq * size) / SPATIAL_PERIODS;
  return {
    x: (size * CURVE_WIDTH_FACTOR) / 2 - shift,
    y: size / 2,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 0.06 + Math.sin(t * Math.PI * 2) * 0.04,
  };
});

export const MirageHeatFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {WAVE_SEEDS.map((seed, i) => (
      <LoopLayer
        key={`wave-${seed.yFrac}`}
        sample={WAVE_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        width={size * CURVE_WIDTH_FACTOR}
        height={size}
      >
        <Svg width={size * CURVE_WIDTH_FACTOR} height={size}>
          <Path
            d={wavePath(seed, size)}
            stroke={STROKE_COLOR}
            strokeWidth={size * 0.008}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </LoopLayer>
    ))}
  </View>
));
MirageHeatFlair.displayName = 'MirageHeatFlair';

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
