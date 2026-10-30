/**
 * LightPillarFlair — Light Pillar
 *
 * Four corner pillars of light rise in turn: a thin beam, a spark at its base and a fading glow
 * trail. Each corner pulses for 1.2 s, staggered 1.5 s apart inside an 8 s loop.
 */
import { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type DotSampler, type LineSampler, LoopDot, LoopLine } from '@/components/loopMotion';

import type { FlairProps } from './FlairProps';

const GLOW_STEPS = 4;
const PILLAR_CYCLE = 8000;
const PULSE_DURATION = 1200;
const CORNER_STAGGER = 1500;
const PILLAR_HEIGHT = 0.12;

const CORNERS = [
  { xFrac: 0.08, yFrac: 1, dir: -1 },
  { xFrac: 0.92, yFrac: 1, dir: -1 },
  { xFrac: 0.05, yFrac: 0, dir: 1 },
  { xFrac: 0.95, yFrac: 0, dir: 1 },
] as const;

type Corner = (typeof CORNERS)[number];

function cornerPulse(t: number, cornerIndex: number): number {
  const elapsed = t * PILLAR_CYCLE - cornerIndex * CORNER_STAGGER;
  if (elapsed <= 0 || elapsed >= PULSE_DURATION) return 0;
  return Math.sin((elapsed / PULSE_DURATION) * Math.PI) ** 2;
}

const BEAM_SAMPLERS: readonly LineSampler[] = CORNERS.map((corner, cornerIndex) => (t, size) => {
  const pulse = cornerPulse(t, cornerIndex);
  const height = size * PILLAR_HEIGHT * pulse;
  return {
    x1: corner.xFrac * size,
    y1: corner.yFrac * size,
    x2: corner.xFrac * size,
    y2: corner.yFrac * size + corner.dir * height * 0.8,
    strokeWidth: 1,
    opacity: pulse * 0.45,
  };
});

const SPARK_SAMPLERS: readonly DotSampler[] = CORNERS.map((corner, cornerIndex) => (t, size) => ({
  cx: corner.xFrac * size,
  cy: corner.yFrac * size,
  r: size * 0.01,
  opacity: cornerPulse(t, cornerIndex) * 0.55,
}));

function createGlowSampler(corner: Corner, cornerIndex: number, step: number): DotSampler {
  const frac = step / GLOW_STEPS;
  return (t, size) => {
    const pulse = cornerPulse(t, cornerIndex);
    const height = size * PILLAR_HEIGHT * pulse;
    return {
      cx: corner.xFrac * size,
      cy: corner.yFrac * size + corner.dir * height * frac,
      r: size * 0.015,
      opacity: (1 - frac) * pulse * 0.1,
    };
  };
}

const GLOW_SAMPLERS: readonly (readonly DotSampler[])[] = CORNERS.map((corner, cornerIndex) =>
  Array.from({ length: GLOW_STEPS }, (_, step) => createGlowSampler(corner, cornerIndex, step)),
);

export const LightPillarFlair = memo<FlairProps>(({ size }) => (
  <View style={[styles.wrapper, { width: size, height: size }]}>
    {CORNERS.map((corner, cornerIndex) => (
      <Fragment key={`${corner.xFrac}-${corner.yFrac}`}>
        {GLOW_SAMPLERS[cornerIndex]!.map((sampler, step) => (
          <LoopDot
            key={`glow-${step}`}
            sample={sampler}
            size={size}
            durationMs={PILLAR_CYCLE}
            color="rgb(255,230,130)"
          />
        ))}
        <LoopLine
          sample={BEAM_SAMPLERS[cornerIndex]!}
          size={size}
          durationMs={PILLAR_CYCLE}
          color="rgb(255,240,180)"
        />
        <LoopDot
          sample={SPARK_SAMPLERS[cornerIndex]!}
          size={size}
          durationMs={PILLAR_CYCLE}
          color="rgb(255,245,200)"
        />
      </Fragment>
    ))}
  </View>
));
LightPillarFlair.displayName = 'LightPillarFlair';

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 },
});
