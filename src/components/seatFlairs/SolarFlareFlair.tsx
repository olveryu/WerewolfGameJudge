/**
 * SolarFlareFlair — Solar Flare.
 *
 * 4 arc flares erupt from the edge, three layers (outer halo / mid / core) stacked, plus tip particles.
 * Every arc is centred on the tile centre, so its radius growth is a uniform scale and its sweep a
 * rotation: each layer is a static arc at `baseR` inside a LoopLayer. The stroke scales with the
 * radius (up to ×1.29 at full intensity) instead of staying constant.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 4500;
const FLARE_COUNT = 4;
const BASE_R_FRAC = 0.42;
const RAD_TO_DEG = 180 / Math.PI;

const FLARE_SEEDS = Array.from({ length: FLARE_COUNT }, (_, i) => ({
  angle: (i / FLARE_COUNT) * Math.PI * 2 - Math.PI / 4,
  phase: i / FLARE_COUNT,
  arcSpan: 0.6 + (i % 2) * 0.3,
}));

type FlareSeed = (typeof FLARE_SEEDS)[number];

const ARC_LAYERS = [
  { stroke: 'rgb(255,120,40)', reachFrac: 0.12, spanMul: 1, alpha: 0.2, widthFrac: 0.04 },
  { stroke: 'rgb(255,180,60)', reachFrac: 0.1, spanMul: 0.7, alpha: 0.4, widthFrac: 0.02 },
  { stroke: 'rgb(255,240,200)', reachFrac: 0.08, spanMul: 0.4, alpha: 0.7, widthFrac: 0.008 },
] as const;

type ArcLayer = (typeof ARC_LAYERS)[number];

function intensityAt(t: number): number {
  return t < 0.3 ? t / 0.3 : t < 0.6 ? 1 : (1 - t) / 0.4;
}

function buildArc(cx: number, cy: number, r: number, span: number, a: number): string {
  const a1 = a - span / 2;
  const a2 = a + span / 2;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

/** Arc motion depends only on the layer; the seed's angle / span live in the static artwork. */
const ARC_SAMPLERS: readonly LayerSampler[] = ARC_LAYERS.map((layer) => (t, size) => {
  const baseR = size * BASE_R_FRAC;
  const intensity = intensityAt(t);
  const r = baseR + intensity * size * layer.reachFrac;
  return {
    x: size / 2,
    y: size / 2,
    rotateDeg: t * 0.3 * RAD_TO_DEG,
    scaleX: r / baseR,
    scaleY: r / baseR,
    opacity: intensity * layer.alpha,
  };
});

const TIP_SAMPLERS: readonly DotSampler[] = FLARE_SEEDS.map((seed) => (t, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * BASE_R_FRAC;
  const intensity = intensityAt(t);
  const r = baseR + intensity * size * 0.14;
  const tipAngle = seed.angle + t * 0.3 + seed.arcSpan / 2;
  return {
    cx: cx + Math.cos(tipAngle) * r,
    cy: cy + Math.sin(tipAngle) * r,
    r: size * 0.012 * intensity,
    opacity: intensity * 0.6,
  };
});

/** Static arc at `baseR` and the seed's start angle, in tile pixel space. */
function ArcArt({ seed, layer, size }: { seed: FlareSeed; layer: ArcLayer; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * BASE_R_FRAC;
  return (
    <Svg width={size} height={size}>
      <Path
        d={buildArc(cx, cy, baseR, seed.arcSpan * layer.spanMul, seed.angle)}
        stroke={layer.stroke}
        strokeWidth={size * layer.widthFrac}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export const SolarFlareFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {FLARE_SEEDS.map((seed, i) => (
      <Fragment key={`flare-${seed.phase}`}>
        {ARC_LAYERS.map((layer, l) => (
          <LoopLayer
            key={layer.stroke}
            sample={ARC_SAMPLERS[l]!}
            size={size}
            durationMs={LOOP_MS}
            phase={seed.phase}
            width={size}
            height={size}
          >
            <ArcArt seed={seed} layer={layer} size={size} />
          </LoopLayer>
        ))}
        <LoopDot
          sample={TIP_SAMPLERS[i]!}
          size={size}
          durationMs={LOOP_MS}
          phase={seed.phase}
          color="rgb(255,255,200)"
        />
      </Fragment>
    ))}
  </View>
));
SolarFlareFlair.displayName = 'SolarFlareFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
