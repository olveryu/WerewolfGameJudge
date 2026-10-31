/**
 * FlowerBloomFlair — Flower Bloom
 *
 * 5 small flowers alternately bloom around the perimeter, each with 5 petals (dot clusters) + a center.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const COLORS = [
  [255, 130, 160],
  [255, 150, 180],
  [240, 120, 170],
  [255, 160, 140],
  [250, 140, 190],
] as const;

const FLOWER_INDICES = [0, 1, 2, 3, 4] as const;
const PETAL_INDICES = [0, 1, 2, 3, 4] as const;

type FlowerIndex = (typeof FLOWER_INDICES)[number];
type PetalIndex = (typeof PETAL_INDICES)[number];

function flowerFrame(f: FlowerIndex, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const dist = size * 0.32;
  const baseAngle = (f / 5) * Math.PI * 2;
  const fx = cx + Math.cos(baseAngle + t * Math.PI * 0.5) * dist;
  const fy = cy + Math.sin(baseAngle + t * Math.PI * 0.5) * dist;
  const bloom = 0.3 + 0.7 * Math.abs(Math.sin((t * 2 + f * 0.8) * Math.PI));
  const petalR = size * 0.015 * bloom;
  return { fx, fy, bloom, petalR };
}

function createPetalSampler(f: FlowerIndex, p: PetalIndex): DotSampler {
  return (t, size) => {
    const { fx, fy, bloom, petalR } = flowerFrame(f, t, size);
    const pa = (p / 5) * Math.PI * 2 + t * Math.PI;
    return {
      cx: fx + Math.cos(pa) * petalR * 1.2,
      cy: fy + Math.sin(pa) * petalR * 1.2,
      r: petalR * 0.7,
      opacity: bloom * 0.5,
    };
  };
}

function createCenterSampler(f: FlowerIndex): DotSampler {
  return (t, size) => {
    const { fx, fy, bloom, petalR } = flowerFrame(f, t, size);
    return { cx: fx, cy: fy, r: petalR * 0.4, opacity: bloom * 0.8 };
  };
}

const PETAL_SAMPLERS: readonly (readonly DotSampler[])[] = FLOWER_INDICES.map((f) =>
  PETAL_INDICES.map((p) => createPetalSampler(f, p)),
);
const CENTER_SAMPLERS: readonly DotSampler[] = FLOWER_INDICES.map((f) => createCenterSampler(f));

function petalColor(f: FlowerIndex): string {
  const [cr, cg, cb] = COLORS[f];
  return `rgb(${cr},${cg},${cb})`;
}

export const FlowerBloomFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FLOWER_INDICES.map((f) => (
      <Fragment key={`flower-${f}`}>
        {PETAL_INDICES.map((p) => (
          <LoopDot
            key={`petal-${p}`}
            sample={PETAL_SAMPLERS[f]![p]!}
            size={size}
            durationMs={LOOP_MS}
            color={petalColor(f)}
          />
        ))}
        <LoopDot
          sample={CENTER_SAMPLERS[f]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(255,230,150)"
        />
      </Fragment>
    ))}
  </View>
));
FlowerBloomFlair.displayName = 'FlowerBloomFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
