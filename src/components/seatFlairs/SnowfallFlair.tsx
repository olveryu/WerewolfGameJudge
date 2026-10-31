/**
 * SnowfallFlair — Snowfall
 *
 * 10 snowflakes drift down from above, each drawn as a 6-pointed star using 3 crossing lines, slowly rotating.
 * The three lines and centre dot form a rigid star turning by `tt * π`, so each flake is one
 * LoopLayer rotating a static group. Each flake runs at its own `speed`, so the phase stays
 * inside the sampler.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const N = 10;
const ARM_COUNT = 3;
/** Layer box as a multiple of flake radius; leaves room for the stroke. */
const BOX_FACTOR = 3;
const RAD_TO_DEG = 180 / Math.PI;

const SNOWFLAKE_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.05 + (i * 0.9) / (N - 1),
  phase: i / N,
  rFrac: 0.008 + (i % 3) * 0.005,
  speed: 0.4 + (i % 4) * 0.1,
  sway: 0.02 + (i % 3) * 0.015,
}));

type SnowflakeSeed = (typeof SNOWFLAKE_SEEDS)[number];

const SNOWFLAKE_SAMPLERS: readonly LayerSampler[] = SNOWFLAKE_SEEDS.map((seed) => (t, size) => {
  const tt = (t * seed.speed + seed.phase) % 1;
  const y = tt * size;
  const x = seed.xFrac * size + Math.sin(tt * Math.PI * 4) * size * seed.sway;
  const alpha = tt < 0.05 ? tt / 0.05 : tt > 0.9 ? (1 - tt) / 0.1 : 0.7;
  const ang = tt * Math.PI;
  return { x, y, rotateDeg: ang * RAD_TO_DEG, scaleX: 1, scaleY: 1, opacity: alpha };
});

const ARM_ANGLES = Array.from({ length: ARM_COUNT }, (_, i) => (i / ARM_COUNT) * Math.PI);

/** Static flake at `tt = 0`: three arms at 0 / 60 / 120 degrees plus the centre dot. */
function SnowflakeArt({ seed, size }: { seed: SnowflakeSeed; size: number }) {
  const r = seed.rFrac * size;
  const box = r * BOX_FACTOR;
  const half = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      {ARM_ANGLES.map((ang) => (
        <Line
          key={`arm-${ang}`}
          x1={-Math.cos(ang) * r}
          y1={-Math.sin(ang) * r}
          x2={Math.cos(ang) * r}
          y2={Math.sin(ang) * r}
          stroke="rgb(220,230,255)"
          strokeWidth={0.8}
          opacity={0.8}
        />
      ))}
      <Circle r={size * 0.005} fill="rgb(240,245,255)" opacity={0.9} />
    </Svg>
  );
}

export const SnowfallFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {SNOWFLAKE_SEEDS.map((seed, i) => (
      <LoopLayer
        key={`flake-${seed.xFrac}`}
        sample={SNOWFLAKE_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        width={seed.rFrac * size * BOX_FACTOR}
        height={seed.rFrac * size * BOX_FACTOR}
      >
        <SnowflakeArt seed={seed} size={size} />
      </LoopLayer>
    ))}
  </View>
));
SnowfallFlair.displayName = 'SnowfallFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
