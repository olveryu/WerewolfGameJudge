/**
 * PetalDanceFlair — Petal Dance
 *
 * 8 petals drift down from above in spiral paths, each rendered as an oval path with rotation sway.
 * The sway only scales both Q control points horizontally about the petal axis, so each petal is one
 * static shape moved by a LoopLayer with `scaleX = 1 + sway`.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 5000;
const PETAL_COUNT = 8;
const PINK_SHADES = [
  [255, 180, 200],
  [255, 160, 190],
  [255, 200, 210],
  [240, 150, 180],
  [255, 170, 195],
  [250, 190, 205],
  [255, 155, 185],
  [245, 175, 200],
] as const;
const PETAL_STROKE_WIDTH = 0.5;

const PETAL_SEEDS = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  xOff: 0.1 + (i * 0.8) / (PETAL_COUNT - 1),
  spiralR: 0.04 + (i % 3) * 0.02,
  rotSpeed: 1 + (i % 2) * 0.5,
  phase: i / PETAL_COUNT,
  petalW: 0.015 + (i % 3) * 0.005,
  petalH: 0.025 + (i % 2) * 0.01,
  ci: i % PINK_SHADES.length,
}));

type PetalSeed = (typeof PETAL_SEEDS)[number];

/** Layer box: the `sway = 0` petal plus its stroke. */
function petalBox(seed: PetalSeed, size: number): { width: number; height: number } {
  return {
    width: 2 * seed.petalW * size + PETAL_STROKE_WIDTH,
    height: 2 * seed.petalH * size + PETAL_STROKE_WIDTH,
  };
}

/** Petal shape at `sway = 0`: simple elongated ellipse approximation, centred on the origin. */
function petalPath(seed: PetalSeed, size: number): string {
  const w = seed.petalW * size;
  const h = seed.petalH * size;
  return `M 0 ${-h} Q ${w} 0 0 ${h} Q ${-w} 0 0 ${-h} Z`;
}

const PETAL_SAMPLERS: readonly LayerSampler[] = PETAL_SEEDS.map((seed) => (t, size) => {
  // Fall from top to bottom with spiral sway
  const y = t * size * 1.1 - size * 0.05;
  const x = size * seed.xOff + Math.sin(t * Math.PI * 2 * seed.rotSpeed) * seed.spiralR * size;
  const sway = Math.sin(t * Math.PI * 4) * 0.5;
  const alpha = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 0.4;
  return { x, y, rotateDeg: 0, scaleX: 1 + sway, scaleY: 1, opacity: alpha };
});

export const PetalDanceFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {PETAL_SEEDS.map((seed, i) => {
      const [cr, cg, cb] = PINK_SHADES[seed.ci]!;
      const { width, height } = petalBox(seed, size);
      return (
        <LoopLayer
          key={`petal-${seed.xOff}`}
          sample={PETAL_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          width={width}
          height={height}
        >
          <Svg
            width={width}
            height={height}
            viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
          >
            <Path
              d={petalPath(seed, size)}
              fill={`rgb(${cr},${cg},${cb})`}
              stroke={`rgb(${cr - 20},${cg - 20},${cb - 20})`}
              strokeWidth={PETAL_STROKE_WIDTH}
            />
          </Svg>
        </LoopLayer>
      );
    })}
  </View>
));
PetalDanceFlair.displayName = 'PetalDanceFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
