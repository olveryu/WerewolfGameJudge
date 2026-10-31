/**
 * AmberDropFlair — amber drops effect.
 *
 * 5 amber teardrops sway slowly down in a pendulum arc, with glossy highlight points. Each
 * teardrop is a rigid shape translated by one LoopLayer; the glint is a LoopDot.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4500;
const DROP_COUNT = 5;
/** Layer box as a multiple of drop radius; the teardrop spans 3 r tall plus its stroke. */
const BOX_FACTOR = 4;

const DROP_SEEDS = Array.from({ length: DROP_COUNT }, (_, i) => ({
  xAnchor: 0.15 + (i * 0.7) / (DROP_COUNT - 1),
  swingAmp: 0.03 + (i % 3) * 0.015,
  phase: i / DROP_COUNT,
  rFrac: 0.018 + (i % 2) * 0.008,
}));

type DropSeed = (typeof DROP_SEEDS)[number];

/**
 * Teardrop: top narrow, bottom round. The original spans `y - 2r … y + r` around its anchor;
 * here it is drawn centred on the origin (`-1.5r … 1.5r`) so the layer centre is `y - 0.5r`.
 */
function dropPath(r: number): string {
  const top = -r * 1.5;
  const mid = r * 0.5;
  return `M 0 ${top} Q ${-r} ${top + r} ${-r} ${mid} A ${r} ${r} 0 1 0 ${r} ${mid} Q ${r} ${top + r} 0 ${top} Z`;
}

function dropCentre(t: number, size: number, seed: DropSeed): { cx: number; y: number; r: number } {
  const y = t * size;
  const swing = Math.sin(t * Math.PI * 3) * seed.swingAmp * size;
  const cx = seed.xAnchor * size + swing;
  const r = seed.rFrac * size;
  return { cx, y, r };
}

const DROP_SAMPLERS: readonly LayerSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const { cx, y, r } = dropCentre(t, size, seed);
  const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.5;
  return { x: cx, y: y - r * 0.5, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

const GLINT_SAMPLERS: readonly DotSampler[] = DROP_SEEDS.map((seed) => (t, size) => {
  const { cx, y, r } = dropCentre(t, size, seed);
  return {
    cx: cx - r * 0.3,
    cy: y - r * 0.3,
    r: r * 0.25,
    opacity: t > 0.1 && t < 0.8 ? 0.6 : 0,
  };
});

export const AmberDropFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {DROP_SEEDS.map((seed, i) => {
      const r = seed.rFrac * size;
      const box = r * BOX_FACTOR;
      const half = box / 2;
      return (
        <Fragment key={`drop-${seed.xAnchor}`}>
          <LoopLayer
            sample={DROP_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={box}
            height={box}
          >
            <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
              <Path
                d={dropPath(r)}
                fill="rgb(200,150,40)"
                stroke="rgb(220,170,60)"
                strokeWidth={size * 0.003}
              />
            </Svg>
          </LoopLayer>
          <LoopDot
            sample={GLINT_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            color="rgb(255,230,150)"
          />
        </Fragment>
      );
    })}
  </View>
));
AmberDropFlair.displayName = 'AmberDropFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
