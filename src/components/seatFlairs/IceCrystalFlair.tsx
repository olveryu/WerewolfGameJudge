/**
 * IceCrystalFlair — Ice Crystal Prism
 *
 * 6 rotating hexagonal ice crystals on the perimeter, pulse-flickering, thin lines connecting to center.
 * Each hexagon is a rigid outline moved and spun by one LoopLayer; its orbit position and the
 * half-turn rotation per loop are the layer's translate / rotate.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type DotSampler,
  type LayerSampler,
  type LineSampler,
  LoopDot,
  LoopLayer,
  LoopLine,
} from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 8000;
const N = 6;
const HEX_SIDES = 6;
const HEX_R_FRAC = 0.04;
/** Layer box as a multiple of hexagon radius; leaves room for the stroke. */
const HEX_BOX_FACTOR = 3;
const HEX_STROKE = 'rgb(150,220,255)';

const CRYSTAL_SEEDS = Array.from({ length: N }, (_, i) => ({ index: i }));

type CrystalSeed = (typeof CRYSTAL_SEEDS)[number];

function crystalFrame(seed: CrystalSeed, t: number, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const dist = size * 0.32;
  const angle = (seed.index / N) * Math.PI * 2 + t * Math.PI * 0.5;
  const x = cx + Math.cos(angle) * dist;
  const y = cy + Math.sin(angle) * dist;
  const pulse = 0.3 + 0.7 * Math.abs(Math.sin((t * 3 + seed.index * 0.5) * Math.PI));
  return { cx, cy, x, y, pulse };
}

const LINE_SAMPLERS: readonly LineSampler[] = CRYSTAL_SEEDS.map((seed) => (t, size) => {
  const { cx, cy, x, y, pulse } = crystalFrame(seed, t, size);
  return { x1: cx, y1: cy, x2: x, y2: y, opacity: pulse * 0.1, strokeWidth: 0.5 };
});

/** Hexagon vertices turn by `t * π` per loop around the crystal centre. */
const HEX_SAMPLERS: readonly LayerSampler[] = CRYSTAL_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = crystalFrame(seed, t, size);
  return { x, y, rotateDeg: t * 180, scaleX: 1, scaleY: 1, opacity: pulse * 0.7 };
});

const DOT_SAMPLERS: readonly DotSampler[] = CRYSTAL_SEEDS.map((seed) => (t, size) => {
  const { x, y, pulse } = crystalFrame(seed, t, size);
  return { cx: x, cy: y, r: size * 0.01, opacity: pulse * 0.8 };
});

/** Static hexagon at `t = 0` (first vertex pointing up), centred on the origin. */
function hexPath(hexR: number): string {
  let d = '';
  for (let h = 0; h < HEX_SIDES; h++) {
    const ha = (h / HEX_SIDES) * Math.PI * 2 - Math.PI / 2;
    const vx = Math.cos(ha) * hexR;
    const vy = Math.sin(ha) * hexR;
    d += h === 0 ? `M ${vx} ${vy}` : ` L ${vx} ${vy}`;
  }
  d += ' Z';
  return d;
}

function HexArt({ size }: { size: number }) {
  const hexR = size * HEX_R_FRAC;
  const box = hexR * HEX_BOX_FACTOR;
  const half = box / 2;
  return (
    <Svg width={box} height={box} viewBox={`${-half} ${-half} ${box} ${box}`}>
      <Path d={hexPath(hexR)} stroke={HEX_STROKE} fill="none" strokeWidth={1.2} />
    </Svg>
  );
}

export const IceCrystalFlair = memo<FlairProps>(({ size }) => {
  const box = size * HEX_R_FRAC * HEX_BOX_FACTOR;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {CRYSTAL_SEEDS.map((seed, i) => (
        <Fragment key={`crystal-${seed.index}`}>
          <LoopLine
            sample={LINE_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            color={HEX_STROKE}
          />
          <LoopLayer
            sample={HEX_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            width={box}
            height={box}
          >
            <HexArt size={size} />
          </LoopLayer>
          <LoopDot
            sample={DOT_SAMPLERS[i]!}
            size={size}
            durationMs={LOOP_MS}
            color="rgb(200,240,255)"
          />
        </Fragment>
      ))}
    </View>
  );
});
IceCrystalFlair.displayName = 'IceCrystalFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
