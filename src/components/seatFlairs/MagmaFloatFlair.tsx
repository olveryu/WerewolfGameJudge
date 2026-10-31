/**
 * MagmaFloatFlair — Magma Float
 *
 * 6 irregular magma rocks float at the periphery, composed of overlapping circles with bottom heat glow.
 * Each rock (body + lobe + glow) is a rigid group sharing one pulse envelope, so it is one static
 * SVG moved by a LoopLayer with per-circle static opacity.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const N = 6;
/** Layer box as a multiple of rock radius; the glow reaches `y + 0.5 r + 1.3 r` below centre. */
const BOX_FACTOR = 4;

const MAGMA_SEEDS = Array.from({ length: N }, (_, i) => ({
  angle0: (i / N) * Math.PI * 2 + i * 0.4,
  dist: 0.35 + (i % 3) * 0.06,
  phase: i / N,
  rFrac: 0.018 + (i % 3) * 0.007,
}));

/**
 * Position uses the phase-shifted time `tt`; the pulse uses raw loop time `t` with its own
 * `phase * 5` term, so the phase stays inside the sampler instead of an `animationDelay`.
 */
const MAGMA_SAMPLERS: readonly LayerSampler[] = MAGMA_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const tt = (t + seed.phase) % 1;
  const angle = seed.angle0 + Math.sin(tt * Math.PI * 2) * 0.3;
  const dist = seed.dist * size + Math.sin(tt * Math.PI * 4) * size * 0.03;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin((t * 3 + seed.phase * 5) * Math.PI));
  return { x, y, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: pulse };
});

export const MagmaFloatFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {MAGMA_SEEDS.map((seed, i) => {
      const r = seed.rFrac * size;
      const box = r * BOX_FACTOR;
      const half = box / 2;
      return (
        <LoopLayer
          key={`magma-${seed.angle0}`}
          sample={MAGMA_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          width={box}
          height={box}
        >
          <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
            <Circle cx={0} cy={0} r={r} fill="rgb(200,60,20)" opacity={0.6} />
            <Circle cx={r * 0.4} cy={-r * 0.3} r={r * 0.7} fill="rgb(240,120,20)" opacity={0.5} />
            <Circle cx={0} cy={r * 0.5} r={r * 1.3} fill="rgb(255,80,0)" opacity={0.12} />
          </Svg>
        </LoopLayer>
      );
    })}
  </View>
));
MagmaFloatFlair.displayName = 'MagmaFloatFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
