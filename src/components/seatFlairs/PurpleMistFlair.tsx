/**
 * PurpleMistFlair — purple mist swirl
 *
 * 7 purple mist clusters drift around the perimeter, size pulses like breathing, multi-layered gradient simulates soft focus.
 * The three concentric discs of a cluster share one position, scale and `pulse` envelope, so each
 * cluster is one LoopLayer whose children carry the static per-disc opacity weights.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const N = 7;
/** Layer box as a multiple of `maxRFrac * size`; the outer disc peaks at 0.92 × that radius. */
const BOX_FACTOR = 2;

const MIST_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2,
  dist: 0.35 + (i % 3) * 0.05,
  phase: i / N,
  driftSpeed: 0.3 + (i % 4) * 0.15,
  maxRFrac: 0.04 + (i % 3) * 0.02,
}));

type MistSeed = (typeof MIST_SEEDS)[number];

/** Phase enters the drift, wobble and pulse terms with different weights, so it stays in the sampler. */
const MIST_SAMPLERS: readonly LayerSampler[] = MIST_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = seed.angle0 + Math.sin((t * seed.driftSpeed + seed.phase) * Math.PI * 2) * 0.6;
  const dist = seed.dist * size + Math.sin(t * Math.PI * 2 + seed.phase * 5) * size * 0.04;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const pulse = 0.3 + 0.5 * Math.abs(Math.sin((t * 2 + seed.phase * 4) * Math.PI));
  const r = seed.maxRFrac * size * (0.6 + 0.4 * pulse);
  const scale = r / (seed.maxRFrac * size);
  return { x, y, rotateDeg: 0, scaleX: scale, scaleY: scale, opacity: pulse };
});

/** Static cluster artwork centred on the origin at `pulse`-independent radius `maxRFrac * size`. */
function MistArt({ seed, size }: { seed: MistSeed; size: number }) {
  const r = seed.maxRFrac * size;
  const box = r * BOX_FACTOR;
  const half = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Circle r={r} fill="rgb(80,30,160)" opacity={0.08} />
      <Circle r={r * 0.6} fill="rgb(100,50,180)" opacity={0.15} />
      <Circle r={r * 0.3} fill="rgb(140,80,200)" opacity={0.25} />
    </Svg>
  );
}

export const PurpleMistFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {MIST_SEEDS.map((seed, i) => (
      <LoopLayer
        key={`mist-${seed.phase}`}
        sample={MIST_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        width={seed.maxRFrac * size * BOX_FACTOR}
        height={seed.maxRFrac * size * BOX_FACTOR}
      >
        <MistArt seed={seed} size={size} />
      </LoopLayer>
    ))}
  </View>
));
PurpleMistFlair.displayName = 'PurpleMistFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
