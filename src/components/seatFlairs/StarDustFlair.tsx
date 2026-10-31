/**
 * StarDustFlair — drifting stardust
 *
 * 7 tiny cross-stars twinkle around the perimeter (cross lines + diagonals + center circle = 5 elements per star).
 * Every element of a star shares one alpha envelope, so each star is one static SVG group faded by a
 * LoopLayer; the per-element alpha multipliers are static opacities on the SVG children.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const STAR_COUNT = 7;
/** Layer box as a fraction of tile size; covers the longest arm (0.041) plus stroke on each side. */
const BOX_FRAC = 0.1;

const STAR_SEEDS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  xFrac: 0.1 + (((i * 17 + 3) % 11) / 12) * 0.8,
  yFrac: 0.1 + (((i * 13 + 5) % 9) / 10) * 0.8,
  phase: i / STAR_COUNT,
  armLen: 0.025 + (i % 3) * 0.008,
}));

type StarSeed = (typeof STAR_SEEDS)[number];

function getAlpha(cycle: number): number {
  if (cycle < 0.2) return cycle / 0.2;
  if (cycle < 0.4) return 1;
  if (cycle < 0.6) return 1 - (cycle - 0.4) / 0.2;
  return 0;
}

const STAR_SAMPLERS: readonly LayerSampler[] = STAR_SEEDS.map((seed) => (t, size) => ({
  x: seed.xFrac * size,
  y: seed.yFrac * size,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: getAlpha(t),
}));

/** Static star artwork centred on the origin. */
function StarArt({ seed, size }: { seed: StarSeed; size: number }) {
  const box = size * BOX_FRAC;
  const half = box / 2;
  const arm = seed.armLen * size;
  const da = arm * 0.6;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Line
        x1={-arm}
        y1={0}
        x2={arm}
        y2={0}
        stroke="rgb(255,255,220)"
        strokeWidth={size * 0.006}
        opacity={0.5}
      />
      <Line
        x1={0}
        y1={-arm}
        x2={0}
        y2={arm}
        stroke="rgb(255,255,220)"
        strokeWidth={size * 0.006}
        opacity={0.5}
      />
      <Line
        x1={-da}
        y1={-da}
        x2={da}
        y2={da}
        stroke="rgb(220,220,255)"
        strokeWidth={size * 0.004}
        opacity={0.3}
      />
      <Line
        x1={da}
        y1={-da}
        x2={-da}
        y2={da}
        stroke="rgb(220,220,255)"
        strokeWidth={size * 0.004}
        opacity={0.3}
      />
      <Circle cx={0} cy={0} r={size * 0.008} fill="rgb(255,255,255)" opacity={0.8} />
    </Svg>
  );
}

export const StarDustFlair = memo<FlairProps>(({ size }) => {
  const box = size * BOX_FRAC;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {STAR_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`star-${seed.phase}`}
          sample={STAR_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          width={box}
          height={box}
        >
          <StarArt seed={seed} size={size} />
        </LoopLayer>
      ))}
    </View>
  );
});
StarDustFlair.displayName = 'StarDustFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
