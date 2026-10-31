/**
 * BlazeTrailFlair — Blaze trail
 *
 * 3 flame arcs rotate around the avatar; each arc is a three-layer stroke + bright head particle.
 * Arc and head turn together as one rigid group, so each flame is a static SVG spun by one
 * LoopLayer about the tile centre; the per-layer opacities are static.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3500;
const ARC_COUNT = 3;
const COLORS = [
  { outer: 'rgb(255,80,0)', mid: 'rgb(255,160,40)', core: 'rgb(255,240,180)' },
  { outer: 'rgb(255,100,20)', mid: 'rgb(255,180,60)', core: 'rgb(255,245,200)' },
  { outer: 'rgb(255,60,10)', mid: 'rgb(255,140,30)', core: 'rgb(255,235,170)' },
];

const ARC_SEEDS = Array.from({ length: ARC_COUNT }, (_, i) => ({
  phase: i / ARC_COUNT,
  span: 0.8 + (i % 2) * 0.3,
}));

function buildArcD(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + Math.cos(startAngle) * radius;
  const y1 = cy + Math.sin(startAngle) * radius;
  const x2 = cx + Math.cos(endAngle) * radius;
  const y2 = cy + Math.sin(endAngle) * radius;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

/** `startA = t * 2π` in the original: the whole flame spins once per loop. */
const arcSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

export const BlazeTrailFlair = memo<FlairProps>(({ size }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {ARC_SEEDS.map((seed, i) => {
        const { outer, mid, core } = COLORS[i]!;
        const headAngle = seed.span;
        return (
          <LoopLayer
            key={`arc-${seed.phase}`}
            sample={arcSampler}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={size}
            height={size}
          >
            <Svg width={size} height={size}>
              <Path
                d={buildArcD(cx, cy, r, 0, seed.span)}
                stroke={outer}
                strokeWidth={size * 0.03}
                opacity={0.25}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={buildArcD(cx, cy, r, seed.span * 0.15, seed.span * 0.85)}
                stroke={mid}
                strokeWidth={size * 0.015}
                opacity={0.45}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={buildArcD(cx, cy, r, seed.span * 0.3, seed.span * 0.7)}
                stroke={core}
                strokeWidth={size * 0.006}
                opacity={0.65}
                fill="none"
                strokeLinecap="round"
              />
              <Circle
                cx={cx + Math.cos(headAngle) * r}
                cy={cy + Math.sin(headAngle) * r}
                r={size * 0.012}
                fill={core}
                opacity={0.7}
              />
            </Svg>
          </LoopLayer>
        );
      })}
    </View>
  );
});
BlazeTrailFlair.displayName = 'BlazeTrailFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
