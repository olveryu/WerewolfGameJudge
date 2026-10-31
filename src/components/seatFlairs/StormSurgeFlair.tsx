/**
 * StormSurgeFlair — Storm Surge
 *
 * Rain + wave combo: 4 diagonal rain streaks + 2 wave crests at the bottom. Each crest's path only
 * moves up and down by `shift`, so it is a static curve translated vertically by one LoopLayer.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type LayerSampler, type LineSampler, LoopLayer, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const LOOP_MS = 3000;
const RAIN_COUNT = 4;
const WAVE_LAYERS = 2;

const RAIN_SEEDS = Array.from({ length: RAIN_COUNT }, (_, i) => ({
  xOff: 0.1 + (i * 0.7) / (RAIN_COUNT - 1),
  phase: i / RAIN_COUNT,
  len: 0.06 + (i % 2) * 0.03,
}));

const WAVE_INDICES = Array.from({ length: WAVE_LAYERS }, (_, i) => i);

const RAIN_SAMPLERS: readonly LineSampler[] = RAIN_SEEDS.map((seed) => (t, size) => {
  const startX = seed.xOff * size + t * size * 0.1;
  const startY = t * size * 1.2 - size * 0.1;
  const endX = startX + size * 0.03;
  const endY = startY + seed.len * size;
  const alpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 0.2;
  return {
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    strokeWidth: size * 0.004,
    opacity: alpha,
  };
});

/** Static crest at `shift = 0`; the sampler supplies the vertical shift. */
function wavePath(layer: number, size: number): string {
  const baseY = size * (0.82 + layer * 0.08);
  const amp = size * (0.03 - layer * 0.01);
  return `M 0 ${baseY} Q ${size * 0.15} ${baseY - amp} ${size * 0.3} ${baseY} T ${size * 0.6} ${baseY} T ${size * 0.9} ${baseY} L ${size} ${baseY}`;
}

const WAVE_SAMPLERS: readonly LayerSampler[] = WAVE_INDICES.map((layer) => (t, size) => {
  const shift = Math.sin(t * Math.PI * 2 + layer * 1.5) * size * 0.04;
  const alpha = 0.15 - layer * 0.04;
  return { x: size / 2, y: size / 2 + shift, rotateDeg: 0, scaleX: 1, scaleY: 1, opacity: alpha };
});

export const StormSurgeFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {RAIN_SEEDS.map((seed, i) => (
      <LoopLine
        key={`rain-${seed.xOff}`}
        sample={RAIN_SAMPLERS[i]!}
        size={size}
        durationMs={LOOP_MS}
        phase={seed.phase}
        color="rgb(150,180,210)"
      />
    ))}
    {WAVE_INDICES.map((layer) => (
      <LoopLayer
        key={`wave-${layer}`}
        sample={WAVE_SAMPLERS[layer]!}
        size={size}
        durationMs={LOOP_MS}
        width={size}
        height={size}
      >
        <Svg width={size} height={size}>
          <Path
            d={wavePath(layer, size)}
            stroke={layer === 0 ? 'rgb(80,140,200)' : 'rgb(100,160,220)'}
            strokeWidth={size * 0.008}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </LoopLayer>
    ))}
  </View>
));
StormSurgeFlair.displayName = 'StormSurgeFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
