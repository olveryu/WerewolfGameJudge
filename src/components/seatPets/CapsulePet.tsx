/**
 * CapsulePet — egg buddy
 *
 * Companion pet for the gachaMachine reveal animation.
 * Gacha capsule shape: top/bottom halves + eyes peeking from seam + blush + small feet, lid bobs open and shut.
 * The lid is a static path rotated about the seam by one LoopLayer.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2600;
const LID_LOOP_MS = 2000;

/** Lid pivot (seam centre) in viewBox units. */
const LID_OX = 36;
const LID_OY = 38;
/** Lid spans x 20..52, y 18..38 about the pivot → radius ≈ 25.6; box 52 contains it at any angle. */
const LID_BOX_UNITS = 52;

// Lid bounce — oscillating rotation around seam
const lidSampler: LayerSampler = (t, size) => {
  const rot = Math.sin(t * Math.PI * 2) * -8;
  return {
    x: petUnitsToPx(LID_OX, size),
    y: petUnitsToPx(LID_OY, size),
    rotateDeg: rot,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

const LID_VIEWBOX = `${LID_OX - LID_BOX_UNITS / 2} ${LID_OY - LID_BOX_UNITS / 2} ${LID_BOX_UNITS} ${LID_BOX_UNITS}`;

export const CapsulePet = memo<PetProps>(({ size }) => {
  const lidBox = petUnitsToPx(LID_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={`0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`}>
        {/* Bottom half */}
        <Path d="M20 38 Q20 56 36 56 Q52 56 52 38 Z" fill="#ff6b81" />
      </Svg>
      {/* Top half (lid) — animated bounce */}
      <LoopLayer
        sample={lidSampler}
        size={size}
        durationMs={LID_LOOP_MS}
        width={lidBox}
        height={lidBox}
      >
        <Svg width={lidBox} height={lidBox} viewBox={LID_VIEWBOX}>
          <Path d="M20 38 Q20 20 36 18 Q52 20 52 38 Z" fill="#ff4757" opacity={0.9} />
        </Svg>
      </LoopLayer>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`}
        style={StyleSheet.absoluteFill}
      >
        {/* Seam line */}
        <Line x1={20} y1={38} x2={52} y2={38} stroke="#c0392b" strokeWidth={1.5} />
        {/* Eyes peeking from seam */}
        <Circle cx={30} cy={36} r={4} fill="#fff" />
        <Circle cx={42} cy={36} r={4} fill="#fff" />
        <Circle cx={31} cy={36} r={2.5} fill="#1a1a2e" />
        <Circle cx={43} cy={36} r={2.5} fill="#1a1a2e" />
        <Circle cx={31.5} cy={35.5} r={0.8} fill="#fff" />
        <Circle cx={43.5} cy={35.5} r={0.8} fill="#fff" />
        {/* Blush */}
        <Ellipse cx={25} cy={40} rx={3} ry={2} fill="rgba(255,150,150,0.5)" />
        <Ellipse cx={47} cy={40} rx={3} ry={2} fill="rgba(255,150,150,0.5)" />
        {/* Small feet */}
        <Ellipse cx={29} cy={56} rx={4} ry={2} fill="#e84a5f" />
        <Ellipse cx={43} cy={56} rx={4} ry={2} fill="#e84a5f" />
      </Svg>
    </PetFloat>
  );
});
CapsulePet.displayName = 'CapsulePet';
