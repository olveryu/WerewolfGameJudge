/**
 * ChainDragonPet — Chained dragon
 *
 * Companion pet for the chainShatter reveal animation.
 * Green small dragon + two horns + red pupils + swinging broken chain + small wings, floating.
 * Shaking chain links are static rings translated by LoopLayers; wings are static ellipses
 * rotated about their own centre by LoopLayers.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { type LayerSampler, LoopLayer } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2800;
const CHAIN_LOOP_MS = 500;
const WING_LOOP_MS = 2000;

/** Chain link (rx 3, ry 4, stroke 1.5) → half-extent 4.75; box 12 contains it. */
const CHAIN_BOX_UNITS = 12;
const CHAIN_LEFT = { cx: 22, cy: 38 } as const;
const CHAIN_RIGHT = { cx: 50, cy: 36 } as const;
const CHAIN_STROKE = '#a8a8a8';

/** Wing ellipse (rx 4, ry 3) pivots on its own centre; box 10 covers rx at any angle. */
const WING_BOX_UNITS = 10;
const LEFT_WING = { cx: 24, cy: 30 } as const;
const RIGHT_WING = { cx: 48, cy: 30 } as const;
const WING_FILL = 'rgba(107,166,106,0.5)';

// Chain shake — fast oscillation
const chainLeftSampler: LayerSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2) * 1;
  return {
    x: petUnitsToPx(CHAIN_LEFT.cx + dx, size),
    y: petUnitsToPx(CHAIN_LEFT.cy, size),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};
const chainRightSampler: LayerSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2 + 0.4) * 1;
  return {
    x: petUnitsToPx(CHAIN_RIGHT.cx + dx, size),
    y: petUnitsToPx(CHAIN_RIGHT.cy, size),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

// Wing wobble
const leftWingSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(LEFT_WING.cx, size),
  y: petUnitsToPx(LEFT_WING.cy, size),
  rotateDeg: Math.sin(t * Math.PI * 2) * 8,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});
const rightWingSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(RIGHT_WING.cx, size),
  y: petUnitsToPx(RIGHT_WING.cy, size),
  rotateDeg: Math.sin(t * Math.PI * 2 + 0.6) * 8,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

export const ChainDragonPet = memo<PetProps>(({ size }) => {
  const chainBox = petUnitsToPx(CHAIN_BOX_UNITS, size);
  const wingBox = petUnitsToPx(WING_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
        {/* Body */}
        <Ellipse cx={36} cy={44} rx={14} ry={12} fill="#5b8c5a" />
        {/* Tail */}
        <Path
          d="M50 44 Q58 36 56 44 Q54 50 52 46"
          stroke="#5b8c5a"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        {/* Head */}
        <Circle cx={36} cy={28} r={12} fill="#6aa66a" />
        {/* Horns */}
        <Path d="M28 20 L24 12 L30 18" fill="#8bc48a" />
        <Path d="M44 20 L48 12 L42 18" fill="#8bc48a" />
        {/* Eyes */}
        <Circle cx={32} cy={26} r={3} fill="#fff" />
        <Circle cx={40} cy={26} r={3} fill="#fff" />
        <Circle cx={33} cy={26} r={1.8} fill="#c0392b" />
        <Circle cx={41} cy={26} r={1.8} fill="#c0392b" />
        {/* Nose smoke */}
        <Circle cx={34} cy={32} r={0.8} fill="#4a5568" />
        <Circle cx={38} cy={32} r={0.8} fill="#4a5568" />
      </Svg>
      {/* Chain pieces — left */}
      <LoopLayer
        sample={chainLeftSampler}
        size={size}
        durationMs={CHAIN_LOOP_MS}
        width={chainBox}
        height={chainBox}
      >
        <Svg
          width={chainBox}
          height={chainBox}
          viewBox={centredViewBox(CHAIN_LEFT, CHAIN_BOX_UNITS)}
        >
          <Ellipse
            cx={CHAIN_LEFT.cx}
            cy={CHAIN_LEFT.cy}
            rx={3}
            ry={4}
            fill="none"
            stroke={CHAIN_STROKE}
            strokeWidth={1.5}
          />
        </Svg>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        <Ellipse
          cx={18}
          cy={42}
          rx={3}
          ry={4}
          fill="none"
          stroke={CHAIN_STROKE}
          strokeWidth={1.5}
          rotation={20}
          origin="18, 42"
        />
      </Svg>
      {/* Chain pieces — right */}
      <LoopLayer
        sample={chainRightSampler}
        size={size}
        durationMs={CHAIN_LOOP_MS}
        width={chainBox}
        height={chainBox}
      >
        <Svg
          width={chainBox}
          height={chainBox}
          viewBox={centredViewBox(CHAIN_RIGHT, CHAIN_BOX_UNITS)}
        >
          <Ellipse
            cx={CHAIN_RIGHT.cx}
            cy={CHAIN_RIGHT.cy}
            rx={3}
            ry={4}
            fill="none"
            stroke={CHAIN_STROKE}
            strokeWidth={1.5}
          />
        </Svg>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        <Ellipse
          cx={54}
          cy={40}
          rx={3}
          ry={4}
          fill="none"
          stroke={CHAIN_STROKE}
          strokeWidth={1.5}
          rotation={-20}
          origin="54, 40"
        />
      </Svg>
      {/* Small wings */}
      <LoopLayer
        sample={leftWingSampler}
        size={size}
        durationMs={WING_LOOP_MS}
        width={wingBox}
        height={wingBox}
      >
        <Svg width={wingBox} height={wingBox} viewBox={centredViewBox(LEFT_WING, WING_BOX_UNITS)}>
          <Ellipse cx={LEFT_WING.cx} cy={LEFT_WING.cy} rx={4} ry={3} fill={WING_FILL} />
        </Svg>
      </LoopLayer>
      <LoopLayer
        sample={rightWingSampler}
        size={size}
        durationMs={WING_LOOP_MS}
        width={wingBox}
        height={wingBox}
      >
        <Svg width={wingBox} height={wingBox} viewBox={centredViewBox(RIGHT_WING, WING_BOX_UNITS)}>
          <Ellipse cx={RIGHT_WING.cx} cy={RIGHT_WING.cy} rx={4} ry={3} fill={WING_FILL} />
        </Svg>
      </LoopLayer>
    </PetFloat>
  );
});
ChainDragonPet.displayName = 'ChainDragonPet';
