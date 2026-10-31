/** Mythic silver blade-wing frame. Artwork stays inside the shared eight-unit overflow contract. */
import { memo, useCallback, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  type LayerSampler,
  LoopDashFlow,
  LoopLayer,
  type MorphSampler,
} from '@/components/loopMotion';
import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';

import type { FrameProps } from './FrameProps';
import { FRAME_VIEWBOX, FRAME_VIEWBOX_SIZE } from './frameViewBox';
import { NightCrownMotif } from './NightCrownMotif';
import { PerimeterSweep, type SweepSampler } from './PerimeterSweep';

const WING_PATH = 'M1 78 L-3 54 L-2 30 L-5 8 L17 1 H36 M99 78 L103 54 L102 30 L105 8 L83 1 H64';
const ENERGY_DASH = 14;
const ENERGY_GAP = 28;
const ENERGY_TRAVEL = 280;
const RELEASE_DASH = 55;
const RELEASE_TRAVEL = 400;

/** Wings breathe in width about the frame centre. */
const wingsSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 0.94 + Math.sin(t * Math.PI) * 0.06,
  scaleY: 1,
  opacity: 1,
});

/** Energy runs up the wings for the first 65 % of the loop. */
const energySampler: MorphSampler = (t) => ({
  opacity: Math.sin(Math.min(t / 0.65, 1) * Math.PI) * 0.9,
});

/** Crown lifts up to two units and settles. */
const crownSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 - ((5 + Math.sin(t * Math.PI) * 2) * size) / FRAME_VIEWBOX_SIZE,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const crystalSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 0.25 + Math.pow(Math.sin(t * Math.PI), 4) * 0.75,
});

/** Perimeter highlight released by the crown during the second half of the loop. */
const releaseSampler: SweepSampler = (t) => {
  const phase = Math.max(0, (t - 0.5) * 2);
  return { arcLength: phase * RELEASE_TRAVEL + RELEASE_DASH, opacity: Math.sin(phase * Math.PI) };
};

function WingGradient({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={MYTHIC_COLORS.metal} />
        <Stop offset="0.3" stopColor={MYTHIC_COLORS.pearl} />
        <Stop offset="0.6" stopColor={MYTHIC_COLORS.metal} />
        <Stop offset="1" stopColor={MYTHIC_COLORS.silver} />
      </LinearGradient>
    </Defs>
  );
}

/** Coordinates wing movement, ascending energy and a crown-triggered perimeter highlight. */
export const EternalCrownFrame = memo<FrameProps>(({ size, rx }) => {
  const frameGradientId = useId();
  const wingGradientId = useId();

  const renderEnergy = useCallback(
    (dashOffset: number, s: number) => (
      <Svg width={s} height={s} viewBox={FRAME_VIEWBOX}>
        <Path
          d={WING_PATH}
          fill="none"
          stroke={MYTHIC_COLORS.crystal}
          strokeWidth={1.8}
          strokeDasharray={`${ENERGY_DASH} ${ENERGY_GAP}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
    ),
    [],
  );

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
        <WingGradient id={frameGradientId} />
        <Rect
          x={0}
          y={0}
          width={100}
          height={100}
          rx={rx}
          fill="none"
          stroke={`url(#${frameGradientId})`}
          strokeWidth={2.4}
        />
        <Rect
          x={-2}
          y={-2}
          width={104}
          height={104}
          rx={rx + 2}
          fill="none"
          stroke={MYTHIC_COLORS.crimson}
          strokeWidth={0.6}
        />
      </Svg>
      <PerimeterSweep
        size={size}
        rx={rx}
        durationMs={MYTHIC_LOOP_DURATION}
        sample={releaseSampler}
        dashLength={RELEASE_DASH}
        color={MYTHIC_COLORS.pearl}
        strokeWidth={2}
      />
      <LoopLayer
        sample={wingsSampler}
        size={size}
        durationMs={MYTHIC_LOOP_DURATION}
        width={size}
        height={size}
      >
        <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
          <WingGradient id={wingGradientId} />
          <G fill={MYTHIC_COLORS.obsidian} stroke={`url(#${wingGradientId})`} strokeWidth={0.9}>
            <Path d="M3 13 L-7 4 L-4 28 L-8 23 L-4 48 L-7 44 L-3 75 L4 92 L1 63 L3 42 L-1 22 Z" />
            <Path d="M97 13 L107 4 L104 28 L108 23 L104 48 L107 44 L103 75 L96 92 L99 63 L97 42 L101 22 Z" />
          </G>
          <G fill={`url(#${wingGradientId})`}>
            <Path d="M-7 4 L-1 27 L-2 48 L1 77 L-4 58 L-5 27 Z" />
            <Path d="M107 4 L101 27 L102 48 L99 77 L104 58 L105 27 Z" />
          </G>
          <Path d={WING_PATH} fill="none" stroke={MYTHIC_COLORS.enamel} strokeWidth={1.8} />
        </Svg>
        <LoopDashFlow
          size={size}
          durationMs={MYTHIC_LOOP_DURATION}
          dashPeriod={ENERGY_DASH + ENERGY_GAP}
          travel={ENERGY_TRAVEL}
          sample={energySampler}
          renderDashes={renderEnergy}
        />
      </LoopLayer>
      <LoopLayer
        sample={crownSampler}
        size={size}
        durationMs={MYTHIC_LOOP_DURATION}
        width={size}
        height={size}
      >
        <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
          <G transform="translate(32 0) scale(.36 .26)">
            <NightCrownMotif />
          </G>
        </Svg>
        <LoopLayer
          sample={crystalSampler}
          size={size}
          durationMs={MYTHIC_LOOP_DURATION}
          width={size}
          height={size}
        >
          <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
            <G transform="translate(32 0) scale(.36 .26)">
              <Path
                d="M50 28 L58 43 L50 59 L42 43 Z"
                fill={MYTHIC_COLORS.highlight}
                stroke={MYTHIC_COLORS.pearl}
                strokeWidth={2}
              />
            </G>
          </Svg>
        </LoopLayer>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={FRAME_VIEWBOX} style={StyleSheet.absoluteFill}>
        <Path
          d="M33 100 L43 98 L50 103 L57 98 L67 100 L50 108 Z"
          fill={MYTHIC_COLORS.obsidian}
          stroke={MYTHIC_COLORS.silver}
        />
        <Path
          d="M50 96 L54 102 L50 107 L46 102 Z"
          fill={MYTHIC_COLORS.enamel}
          stroke={MYTHIC_COLORS.highlight}
          strokeWidth={0.5}
        />
      </Svg>
      <LoopLayer
        sample={crystalSampler}
        size={size}
        durationMs={MYTHIC_LOOP_DURATION}
        width={size}
        height={size}
      >
        <Svg width={size} height={size} viewBox={FRAME_VIEWBOX}>
          <Path d="M50 96 L54 102 L50 104 Z" fill={MYTHIC_COLORS.crystal} />
        </Svg>
      </LoopLayer>
    </View>
  );
});
EternalCrownFrame.displayName = 'EternalCrownFrame';

const styles = StyleSheet.create({
  frame: { overflow: 'visible' },
});
