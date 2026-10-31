/**
 * CometTailFlair — Comet Trail
 *
 * 3 comets orbit at the periphery, each with 8 fading trail segments. Head, trail and glow orbit
 * as one rigid group under one shared pulse envelope, so each comet is a static SVG spun by one
 * LoopLayer about the tile centre; the per-segment opacity factors are static. The seed phase
 * offsets the pulse, not time, so samplers keep it and no cycle shift is applied.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const COMET_COUNT = 3;
const TRAIL_LEN = 8;
/** Trail segment `j` orbits `j` px outside the head, so the box needs that much slack per side. */
const BOX_PAD_PX = TRAIL_LEN * 2;

const COMET_SEEDS = Array.from({ length: COMET_COUNT }, (_, i) => ({
  angle0: (i / COMET_COUNT) * Math.PI * 2,
  phase: i / COMET_COUNT,
  speed: 0.5 + i * 0.15,
}));

const TRAIL_INDICES = Array.from({ length: TRAIL_LEN + 1 }, (_, j) => j);

/** `angle = angle0 + t * speed * 2π`: the group spins `speed` turns per loop; `pulse` is the envelope. */
const COMET_SAMPLERS: readonly LayerSampler[] = COMET_SEEDS.map((seed) => (t, size) => {
  const pulse = 0.5 + 0.5 * Math.sin((t * 4 + seed.phase * 6) * Math.PI);
  return {
    x: size / 2,
    y: size / 2,
    rotateDeg: t * seed.speed * 360,
    scaleX: 1,
    scaleY: 1,
    opacity: pulse,
  };
});

export const CometTailFlair = memo<FlairProps>(({ size }) => {
  const orbit = size * 0.4;
  const box = size + BOX_PAD_PX;
  const half = box / 2;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {COMET_SEEDS.map((seed, i) => (
        <LoopLayer
          key={`comet-${seed.speed}`}
          sample={COMET_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          width={box}
          height={box}
        >
          <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
            {TRAIL_INDICES.map((j) => {
              const ta = seed.angle0 - j * 0.12;
              const td = orbit + j * 1;
              const r =
                j === 0 ? size * 0.02 : Math.max(size * 0.004, size * 0.018 - j * size * 0.002);
              const alpha = j === 0 ? 0.85 : Math.max(0, 0.5 - j * 0.05);
              return (
                <Circle
                  key={`trail-${j}`}
                  cx={Math.cos(ta) * td}
                  cy={Math.sin(ta) * td}
                  r={r}
                  fill="rgb(180,200,255)"
                  opacity={alpha}
                />
              );
            })}
            <Circle
              cx={Math.cos(seed.angle0) * orbit}
              cy={Math.sin(seed.angle0) * orbit}
              r={size * 0.03}
              fill="rgb(220,235,255)"
              opacity={0.3}
            />
          </Svg>
        </LoopLayer>
      ))}
    </View>
  );
});
CometTailFlair.displayName = 'CometTailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
