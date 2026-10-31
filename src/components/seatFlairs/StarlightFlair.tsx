/**
 * StarlightFlair — Starlight
 *
 * 6 four-pointed stars float around the avatar with cross + diagonal rays + glow halo + center dot.
 * Each star is a rigid static SVG group (halo / rays / dot) carried by one LoopLayer; the twinkle
 * envelope drives the layer opacity and the per-element alpha multipliers are static opacities.
 * The orbit uses the raw loop progress while the twinkle uses the phased one, so the seed phase
 * stays inside the sampler rather than becoming an animation delay.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 6;
const ARM_LEN_FRAC = 0.05;
/** Layer box as a fraction of tile size; covers the arm length plus stroke on each side. */
const BOX_FRAC = 0.12;

const STAR_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.35 + (i % 3) * 0.05,
  phase: i / N,
  drift: 0.4 + (i % 4) * 0.25,
}));

const STAR_SAMPLERS: readonly LayerSampler[] = STAR_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + t * Math.PI * 2 * seed.drift;
  const d = seed.dist * size;
  const x = cx + Math.cos(angle) * d;
  const y = cy + Math.sin(angle) * d;
  const pt = (t + seed.phase) % 1;
  const tw = 0.3 + 0.7 * Math.max(0, Math.sin(pt * Math.PI * 2));
  return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: tw };
});

/** Static star artwork centred on the origin. */
function StarArt({ size }: { size: number }) {
  const box = size * BOX_FRAC;
  const half = box / 2;
  const armLen = size * ARM_LEN_FRAC;
  const diagLen = armLen * 0.55;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Circle cx={0} cy={0} r={armLen * 0.9} fill="rgb(255,250,200)" opacity={0.15} />
      <Line
        x1={-armLen}
        y1={0}
        x2={armLen}
        y2={0}
        stroke="rgb(255,253,224)"
        strokeWidth={1.5}
        opacity={0.8}
      />
      <Line
        x1={0}
        y1={-armLen}
        x2={0}
        y2={armLen}
        stroke="rgb(255,253,224)"
        strokeWidth={1.5}
        opacity={0.8}
      />
      <Line
        x1={-diagLen}
        y1={-diagLen}
        x2={diagLen}
        y2={diagLen}
        stroke="rgb(255,253,224)"
        strokeWidth={1}
        opacity={0.5}
      />
      <Line
        x1={-diagLen}
        y1={diagLen}
        x2={diagLen}
        y2={-diagLen}
        stroke="rgb(255,253,224)"
        strokeWidth={1}
        opacity={0.5}
      />
      <Circle cx={0} cy={0} r={size * 0.008} fill="rgb(255,255,240)" opacity={0.9} />
    </Svg>
  );
}

export const StarlightFlair = memo<FlairProps>(({ size }) => {
  const box = size * BOX_FRAC;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {STAR_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`star-${seed.phase}`}
          sample={STAR_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          width={box}
          height={box}
        >
          <StarArt size={size} />
        </LoopLayer>
      ))}
    </View>
  );
});
StarlightFlair.displayName = 'StarlightFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
