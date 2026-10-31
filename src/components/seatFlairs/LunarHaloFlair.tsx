/**
 * LunarHaloFlair — lunar halo
 *
 * 3 crescent arc light bands rotating around the avatar, with a glow ball at each endpoint.
 * Each arc is a static tile-sized SVG spun about the tile centre by LoopLayer; the glow is a LoopDot.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 6000;
const ARC_COUNT = 3;
const ARC_SPAN = Math.PI * 0.6;

const ARC_SEEDS = Array.from({ length: ARC_COUNT }, (_, i) => ({
  index: i,
  angle0: i * ((Math.PI * 2) / ARC_COUNT),
}));

function arcPulse(t: number, index: number): number {
  return 0.4 + 0.6 * Math.sin((t * 4 + index) * Math.PI);
}

function arcRadius(index: number, size: number): number {
  const orbit = size * 0.42;
  return orbit - index * size * 0.02;
}

/** Static arc at `t = 0` (start angle `angle0`), in tile pixel space. */
function arcPath(index: number, angle: number, size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = arcRadius(index, size);
  const sx = cx + Math.cos(angle) * r;
  const sy = cy + Math.sin(angle) * r;
  const ex = cx + Math.cos(angle + ARC_SPAN) * r;
  const ey = cy + Math.sin(angle + ARC_SPAN) * r;
  return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
}

const ARC_SAMPLERS: readonly LayerSampler[] = ARC_SEEDS.map(({ index }) => (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: arcPulse(t, index) * 0.5,
}));

const GLOW_SAMPLERS: readonly DotSampler[] = ARC_SEEDS.map(({ index }) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const angle = t * Math.PI * 2 + index * ((Math.PI * 2) / ARC_COUNT);
  const r = arcRadius(index, size);
  const ex = cx + Math.cos(angle + ARC_SPAN) * r;
  const ey = cy + Math.sin(angle + ARC_SPAN) * r;
  return { cx: ex, cy: ey, r: size * 0.02, opacity: arcPulse(t, index) * 0.7 };
});

export const LunarHaloFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {ARC_SEEDS.map(({ index, angle0 }) => (
      <Fragment key={`arc-${angle0}`}>
        <LoopLayer
          sample={ARC_SAMPLERS[index]!}
          size={size}
          durationMs={LOOP_MS}
          width={size}
          height={size}
        >
          <Svg width={size} height={size}>
            <Path
              d={arcPath(index, angle0, size)}
              stroke="rgb(180,200,255)"
              strokeWidth={3 - index * 0.5}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </LoopLayer>
        <LoopDot
          sample={GLOW_SAMPLERS[index]!}
          size={size}
          durationMs={LOOP_MS}
          color="rgb(200,220,255)"
        />
      </Fragment>
    ))}
  </View>
));
LunarHaloFlair.displayName = 'LunarHaloFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
