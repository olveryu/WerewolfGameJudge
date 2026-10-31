/**
 * ObsidianPulseFlair — Obsidian Pulse
 *
 * 4 dark geometric diamonds expand outward from the center then contract, alternating in a breathing rhythm.
 * Every vertex is `r × (unit direction)` from the tile centre, so the breathing is a uniform scale of one
 * static diamond drawn at the maximum radius (LoopLayer `scaleX/scaleY`).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const SHAPE_COUNT = 4;
/** Radius at `breathe = 1` (`size * (0.15 + breathe * 0.3)`), as a fraction of tile size. */
const R_MAX_FRAC = 0.45;

const SHAPE_SEEDS = Array.from({ length: SHAPE_COUNT }, (_, i) => ({
  rotation: (i / SHAPE_COUNT) * Math.PI * 2,
  phase: i / SHAPE_COUNT,
}));

type ShapeSeed = (typeof SHAPE_SEEDS)[number];

/** Static diamond at the maximum radius, centred on the tile centre in a tile-sized box. */
function diamondPath(seed: ShapeSeed, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * R_MAX_FRAC;
  const angle = seed.rotation;
  const top = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  const right = {
    x: cx + Math.cos(angle + Math.PI / 2) * r * 0.5,
    y: cy + Math.sin(angle + Math.PI / 2) * r * 0.5,
  };
  const bottom = {
    x: cx + Math.cos(angle + Math.PI) * r,
    y: cy + Math.sin(angle + Math.PI) * r,
  };
  const left = {
    x: cx + Math.cos(angle + Math.PI * 1.5) * r * 0.5,
    y: cy + Math.sin(angle + Math.PI * 1.5) * r * 0.5,
  };
  return `M ${top.x} ${top.y} L ${right.x} ${right.y} L ${bottom.x} ${bottom.y} L ${left.x} ${left.y} Z`;
}

const diamondSampler: LayerSampler = (t, size) => {
  const breathe = 0.5 + Math.sin(t * Math.PI * 2) * 0.5;
  const r = size * (0.15 + breathe * 0.3);
  const scale = r / (size * R_MAX_FRAC);
  const alpha = 0.1 + breathe * 0.15;
  return { x: size / 2, y: size / 2, rotateDeg: 0, scaleX: scale, scaleY: scale, opacity: alpha };
};

export const ObsidianPulseFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SHAPE_SEEDS.map((seed) => (
      <LoopLayer
        key={`diamond-${seed.rotation}`}
        sample={diamondSampler}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        width={size}
        height={size}
      >
        <Svg width={size} height={size}>
          <Path
            d={diamondPath(seed, size)}
            stroke="rgb(120,100,140)"
            strokeWidth={size * 0.004}
            fill="rgb(40,30,60)"
            strokeLinejoin="miter"
          />
        </Svg>
      </LoopLayer>
    ))}
  </View>
));
ObsidianPulseFlair.displayName = 'ObsidianPulseFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
