/**
 * HoundPet — hound
 *
 * Companion pet for the roleHunt card-flip animation.
 * Brown puppy + wobbling ears + magnifying glass + wagging tail, floating.
 * Ears are static ellipses rotated about their own centre by LoopLayers; the wagging tail
 * changes shape, so it is a LoopMorph cross-fading `TAIL_VARIANTS` static curves.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import {
  type LayerSampler,
  LoopLayer,
  LoopMorph,
  type MorphSampler,
} from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 3000;
const LOOP_MS = 2000;

/** Ear ellipses (rx 5, ry 8) pivot on their own centre; box 18 covers ry at any angle. */
const EAR_BOX_UNITS = 18;
const LEFT_EAR = { cx: 24, cy: 20 } as const;
const RIGHT_EAR = { cx: 48, cy: 20 } as const;
const EAR_FILL = '#a67a52';

/** The wag `sin(t·4π)` repeats twice per loop, so each cycle is split into `TAIL_VARIANTS` poses. */
const TAIL_VARIANTS = 8;
const TAIL_CYCLES_PER_LOOP = 2;

// Ear wobble
const leftEarSampler: LayerSampler = (t, size) => {
  const rot = -15 + Math.sin(t * Math.PI * 2) * 10;
  return {
    x: petUnitsToPx(LEFT_EAR.cx, size),
    y: petUnitsToPx(LEFT_EAR.cy, size),
    rotateDeg: rot,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};
const rightEarSampler: LayerSampler = (t, size) => {
  const rot = 15 + Math.sin(t * Math.PI * 2 + 0.6) * 10;
  return {
    x: petUnitsToPx(RIGHT_EAR.cx, size),
    y: petUnitsToPx(RIGHT_EAR.cy, size),
    rotateDeg: rot,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

// Tail wag
const tailSampler: MorphSampler = () => ({ opacity: 1 });

function tailPath(t: number): string {
  const wag = Math.sin(t * Math.PI * 4) * 6;
  const endX = 56 + wag;
  return `M52 46 Q58 38 ${endX} 44`;
}

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

function renderTail(k: number, s: number) {
  return (
    <Svg width={s} height={s} viewBox={PET_VIEWBOX_ATTR}>
      <Path
        d={tailPath(k / TAIL_VARIANTS / TAIL_CYCLES_PER_LOOP)}
        stroke="#c4956a"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function earViewBox(ear: { cx: number; cy: number }): string {
  return `${ear.cx - EAR_BOX_UNITS / 2} ${ear.cy - EAR_BOX_UNITS / 2} ${EAR_BOX_UNITS} ${EAR_BOX_UNITS}`;
}

export const HoundPet = memo<PetProps>(({ size }) => {
  const earBox = petUnitsToPx(EAR_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
        {/* Body */}
        <Ellipse cx={36} cy={46} rx={16} ry={12} fill="#c4956a" />
        {/* Head */}
        <Circle cx={36} cy={30} r={14} fill="#d4a574" />
      </Svg>
      {/* Ears */}
      <LoopLayer
        sample={leftEarSampler}
        size={size}
        durationMs={LOOP_MS}
        width={earBox}
        height={earBox}
      >
        <Svg width={earBox} height={earBox} viewBox={earViewBox(LEFT_EAR)}>
          <Ellipse cx={LEFT_EAR.cx} cy={LEFT_EAR.cy} rx={5} ry={8} fill={EAR_FILL} />
        </Svg>
      </LoopLayer>
      <LoopLayer
        sample={rightEarSampler}
        size={size}
        durationMs={LOOP_MS}
        width={earBox}
        height={earBox}
      >
        <Svg width={earBox} height={earBox} viewBox={earViewBox(RIGHT_EAR)}>
          <Ellipse cx={RIGHT_EAR.cx} cy={RIGHT_EAR.cy} rx={5} ry={8} fill={EAR_FILL} />
        </Svg>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        {/* Eyes */}
        <Circle cx={31} cy={28} r={3} fill="#2d1b1b" />
        <Circle cx={41} cy={28} r={3} fill="#2d1b1b" />
        <Circle cx={32} cy={27} r={1} fill="#fff" />
        <Circle cx={42} cy={27} r={1} fill="#fff" />
        {/* Nose */}
        <Ellipse cx={36} cy={33} rx={3} ry={2} fill="#3d2b1b" />
        {/* Magnifying glass */}
        <Circle cx={52} cy={38} r={6} fill="none" stroke="#7b8fa8" strokeWidth={2} />
        <Circle cx={52} cy={38} r={4} fill="rgba(173,216,230,0.3)" />
        <Line
          x1={56}
          y1={42}
          x2={60}
          y2={48}
          stroke="#7b8fa8"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
      {/* Tail */}
      <LoopMorph
        sample={tailSampler}
        size={size}
        durationMs={LOOP_MS}
        variantCount={TAIL_VARIANTS}
        mode="stacked"
        cyclesPerLoop={TAIL_CYCLES_PER_LOOP}
        renderVariant={renderTail}
      />
    </PetFloat>
  );
});
HoundPet.displayName = 'HoundPet';
