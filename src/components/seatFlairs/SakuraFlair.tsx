/**
 * SakuraFlair — Sakura Petals
 *
 * 6 sakura petals drift down from above with gentle side-to-side sway, fading at the bottom and looping.
 * Each petal is simulated with 5 closely-spaced dots forming an oval. The five dots form a rigid
 * cross that turns by `t * π`, so each petal is one LoopLayer rotating a static group.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 6;
const PETAL_R_FRAC = 0.015;
/** Layer box as a multiple of petal dot radius; outer dots reach 0.6 r + 0.8 r from the centre. */
const BOX_FACTOR = 3;
const RAD_TO_DEG = 180 / Math.PI;

const PETAL_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.1 + (i * 0.8) / (N - 1),
  phase: i / N,
  swayAmp: 0.04 + (i % 3) * 0.02,
  swayFreq: 1.5 + (i % 2) * 0.5,
}));

const PETAL_SAMPLERS: readonly LayerSampler[] = PETAL_SEEDS.map((seed) => (t, size) => {
  const y = t * size;
  const x = seed.xFrac * size + Math.sin(t * Math.PI * 2 * seed.swayFreq) * size * seed.swayAmp;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.7;
  const a = t * Math.PI;
  return { x, y, rotateDeg: a * RAD_TO_DEG, scaleX: 1, scaleY: 1, opacity: alpha };
});

/** Static petal at `a = 0`: centre, fwd/bwd along +x/−x, sides along −y/+y. */
function PetalArt({ size }: { size: number }) {
  const r = size * PETAL_R_FRAC;
  const box = r * BOX_FACTOR;
  const half = box / 2;
  const dx = r * 0.6;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Circle r={r} fill="rgb(255,183,197)" />
      <Circle cx={dx} cy={0} r={r * 0.8} fill="rgb(255,183,197)" />
      <Circle cx={-dx} cy={0} r={r * 0.8} fill="rgb(255,183,197)" />
      <Circle cx={0} cy={-dx} r={r * 0.6} fill="rgb(255,210,220)" opacity={0.6} />
      <Circle cx={0} cy={dx} r={r * 0.6} fill="rgb(255,210,220)" opacity={0.6} />
    </Svg>
  );
}

export const SakuraFlair = memo<FlairProps>(({ size }) => {
  const box = size * PETAL_R_FRAC * BOX_FACTOR;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {PETAL_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`petal-${seed.xFrac}`}
          sample={PETAL_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          width={box}
          height={box}
        >
          <PetalArt size={size} />
        </LoopLayer>
      ))}
    </View>
  );
});
SakuraFlair.displayName = 'SakuraFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
