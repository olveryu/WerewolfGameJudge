/**
 * BloodMarkFlair -- Blood Moon mark
 *
 * 4 dark-red drops fall from the top, leaving stretched trails that fade out at the bottom and loop.
 * Drop and trail fall together with one shared fade envelope, so each drop is a static SVG group
 * translated by one LoopLayer; the per-trail opacity factors are static.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const N = 4;
const TRAIL_LEN = 3;
/** Layer box as a multiple of drop radius; the group spans `-5.05 r … r` around the drop centre. */
const BOX_FACTOR = 8;
/** Layer centre sits this many radii above the drop centre so the group is centred in its box. */
const CENTRE_LIFT = 2;

const DROP_SEEDS = Array.from({ length: N }, (_, i) => ({
  xFrac: 0.2 + (i * 0.6) / (N - 1),
  phase: i / N,
  rFrac: 0.018 + (i % 2) * 0.006,
}));

/** Trails drawn farthest-first so the main drop stacks on top, as in the original render order. */
const TRAIL_INDICES = Array.from({ length: TRAIL_LEN }, (_, k) => TRAIL_LEN - k);

const DROP_SAMPLERS: readonly LayerSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const x = seed.xFrac * size;
  const y = t * size;
  const r = seed.rFrac * size;
  const alpha = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 0.85;
  return { x, y: y - r * CENTRE_LIFT, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

export const BloodMarkFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {DROP_SEEDS.map((seed, i) => {
      const r = seed.rFrac * size;
      const box = r * BOX_FACTOR;
      const half = box / 2;
      const mainCy = r * CENTRE_LIFT;
      return (
        <LoopLayer
          key={`drop-${seed.xFrac}`}
          sample={DROP_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          width={box}
          height={box}
        >
          <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
            {TRAIL_INDICES.map((k) => (
              <Circle
                key={`trail-${k}`}
                cx={0}
                cy={mainCy - k * r * 1.5}
                r={r * (1 - k * 0.15)}
                fill="rgb(140,10,10)"
                opacity={(1 - k / (TRAIL_LEN + 1)) * 0.6}
              />
            ))}
            <Circle cx={0} cy={mainCy} r={r} fill="rgb(180,20,20)" />
          </Svg>
        </LoopLayer>
      );
    })}
  </View>
));
BloodMarkFlair.displayName = 'BloodMarkFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
