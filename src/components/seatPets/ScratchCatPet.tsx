/**
 * ScratchCatPet — Scratch Cat
 *
 * Companion pet for the scratch card flip animation.
 * Creamy yellow kitten + triangle ears + whiskers + paw scratching a gold coin, floating.
 * The paw is a static ellipse translated vertically by a LoopLayer.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2800;
const LOOP_MS = 1500;

/** Paw ellipse (rx 5, ry 4) → half-extent 5; box 12 contains it. */
const PAW_BOX_UNITS = 12;
const PAW = { cx: 22, cy: 46 } as const;
const PAW_FILL = '#ffe4b5';

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

// Paw swipe — translateY + slight rotation
const pawSampler: LayerSampler = (t, size) => {
  const ty = -Math.sin(t * Math.PI * 2) * 3;
  return {
    x: petUnitsToPx(PAW.cx, size),
    y: petUnitsToPx(PAW.cy + ty, size),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

export const ScratchCatPet = memo<PetProps>(({ size }) => {
  const pawBox = petUnitsToPx(PAW_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
        {/* Body */}
        <Ellipse cx={36} cy={50} rx={14} ry={10} fill="#f5deb3" />
        {/* Head */}
        <Circle cx={36} cy={32} r={14} fill="#ffe4b5" />
        {/* Ears — outer */}
        <Polygon points="24,22 20,10 30,18" fill="#ffcc80" />
        <Polygon points="48,22 52,10 42,18" fill="#ffcc80" />
        {/* Ears — inner pink */}
        <Polygon points="25,21 22,13 29,18" fill="#ffb6c1" />
        <Polygon points="47,21 50,13 43,18" fill="#ffb6c1" />
        {/* Eyes */}
        <Ellipse cx={31} cy={30} rx={2.5} ry={3} fill="#2d4a1b" />
        <Ellipse cx={41} cy={30} rx={2.5} ry={3} fill="#2d4a1b" />
        <Circle cx={31.5} cy={29.5} r={0.8} fill="#fff" />
        <Circle cx={41.5} cy={29.5} r={0.8} fill="#fff" />
        {/* Nose + mouth */}
        <Ellipse cx={36} cy={35} rx={2} ry={1.5} fill="#ffb6c1" />
        <Path d="M34 36.5 Q36 38 38 36.5" stroke="#c48a6e" strokeWidth={0.8} fill="none" />
        {/* Whiskers */}
        <Line x1={18} y1={33} x2={28} y2={34} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={18} y1={36} x2={28} y2={36} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={54} y1={33} x2={44} y2={34} stroke="#c4a882" strokeWidth={0.5} />
        <Line x1={54} y1={36} x2={44} y2={36} stroke="#c4a882" strokeWidth={0.5} />
      </Svg>
      {/* Paw with coin */}
      <LoopLayer
        sample={pawSampler}
        size={size}
        durationMs={LOOP_MS}
        width={pawBox}
        height={pawBox}
      >
        <Svg width={pawBox} height={pawBox} viewBox={centredViewBox(PAW, PAW_BOX_UNITS)}>
          <Ellipse cx={PAW.cx} cy={PAW.cy} rx={5} ry={4} fill={PAW_FILL} />
        </Svg>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        <Circle cx={18} cy={42} r={5} fill="#ffd700" stroke="#daa520" strokeWidth={1} />
        <SvgText x={18} y={44} textAnchor="middle" fontSize={6} fill="#b8860b" fontWeight="bold">
          ¥
        </SvgText>
      </Svg>
    </PetFloat>
  );
});
ScratchCatPet.displayName = 'ScratchCatPet';
