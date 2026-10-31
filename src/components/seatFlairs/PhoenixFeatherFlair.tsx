/**
 * PhoenixFeatherFlair - Phoenix feather
 *
 * 8 gold-red feathers spiral up from the outer ring with curved trajectory and glow. Each feather
 * (line + glow disc) is a rigid group moved and rotated by one LoopLayer.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 8;
/** Layer box as a fraction of tile size; covers the 0.035 half-length line plus the 0.025 glow. */
const FEATHER_BOX_FRAC = 0.1;
const RAD_TO_DEG = 180 / Math.PI;

const FEATHER_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle: (i / N) * Math.PI * 2,
  phase: i / N,
  dist: 0.25 + (i % 3) * 0.08,
}));

const FEATHER_SAMPLERS: readonly LayerSampler[] = FEATHER_SEEDS.map((seed) => (tt, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const spiralAngle = seed.angle + tt * Math.PI * 4;
  const dist = (seed.dist + tt * 0.2) * size;
  const y0 = cy - tt * size * 0.3;
  const x0 = cx + Math.cos(spiralAngle) * dist * 0.3;
  const alpha = tt < 0.1 ? tt / 0.1 : tt > 0.7 ? (1 - tt) / 0.3 : 0.9;
  const ang = spiralAngle + Math.PI / 2;
  return { x: x0, y: y0, rotateDeg: ang * RAD_TO_DEG, scaleX: 1, scaleY: 1, opacity: alpha };
});

/** Static feather artwork centred on the origin: horizontal line + glow disc. */
function FeatherArt({ size }: { size: number }) {
  const box = size * FEATHER_BOX_FRAC;
  const half = box / 2;
  const featherLen = size * 0.035;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Line
        x1={-featherLen}
        y1={0}
        x2={featherLen}
        y2={0}
        stroke="rgb(255,160,30)"
        strokeWidth={2}
        opacity={0.8}
      />
      <Circle r={size * 0.025} fill="rgb(255,100,20)" opacity={0.3} />
    </Svg>
  );
}

export const PhoenixFeatherFlair = memo<FlairProps>(({ size }) => {
  const box = size * FEATHER_BOX_FRAC;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {FEATHER_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`feather-${seed.phase}`}
          sample={FEATHER_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          width={box}
          height={box}
        >
          <FeatherArt size={size} />
        </LoopLayer>
      ))}
    </View>
  );
});
PhoenixFeatherFlair.displayName = 'PhoenixFeatherFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
