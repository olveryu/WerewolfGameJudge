/** Legendary frame highlight; one slow edge sweep without changing the frame silhouette. */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PerimeterSweep, roundedRectPerimeter, type SweepSampler } from './PerimeterSweep';

const ORBIT_DURATION = 7000;
const FRAME_SIDE = 100;
const HIGHLIGHT_LENGTH = 12;
const HIGHLIGHT_COLOR = '#FFFDE8';
const HIGHLIGHT_STROKE = 1.2;
const HIGHLIGHT_OPACITY = 0.45;

interface LegendaryShimmerProps {
  /** SVG total size (with viewBox expansion, = avatar size * 116/100) */
  size: number;
  /** Main border corner radius (viewBox units) */
  rx: number;
}

/**
 * One full lap per loop. The arc length depends on `rx`, so each distinct corner radius gets its
 * own sampler (cached by `rx`).
 */
const lapSamplers = new Map<number, SweepSampler>();

function getLapSampler(rx: number): SweepSampler {
  const hit = lapSamplers.get(rx);
  if (hit) return hit;
  const perimeter = roundedRectPerimeter(rx);
  const sampler: SweepSampler = (t) => ({ arcLength: t * perimeter, opacity: HIGHLIGHT_OPACITY });
  lapSamplers.set(rx, sampler);
  return sampler;
}

/** Adds a single restrained highlight to a legendary frame's rounded perimeter. */
export const LegendaryShimmer = memo<LegendaryShimmerProps>(({ size, rx }) => {
  const cornerRadius = Math.min(rx, FRAME_SIDE / 2);
  return (
    <View style={[styles.layer, { width: size, height: size }]}>
      <PerimeterSweep
        size={size}
        rx={cornerRadius}
        durationMs={ORBIT_DURATION}
        sample={getLapSampler(cornerRadius)}
        dashLength={HIGHLIGHT_LENGTH}
        color={HIGHLIGHT_COLOR}
        strokeWidth={HIGHLIGHT_STROKE}
      />
    </View>
  );
});
LegendaryShimmer.displayName = 'LegendaryShimmer';

const styles = StyleSheet.create({
  layer: { overflow: 'visible' },
});
