/**
 * CrystalPet — Crystal ball
 *
 * Companion pet for the tarot flip animation.
 * Purple gradient crystal ball + base + inner star twinkle + nebula pulse.
 * Nebula blobs and stars are LoopDots layered between the ball and its highlight.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 3200;
const LOOP_MS = 3000;

const NEBULA1_FILL = 'rgba(200,180,255,0.2)';
const NEBULA2_FILL = 'rgba(255,200,255,0.15)';
const STAR_FILL = '#fff';

// Inner nebula pulse
const nebula1Sampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(32, size),
  cy: petUnitsToPx(32, size),
  r: petUnitsToPx(6, size),
  opacity: 0.1 + Math.sin(t * Math.PI * 2) * 0.1,
});
const nebula2Sampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(40, size),
  cy: petUnitsToPx(38, size),
  r: petUnitsToPx(4, size),
  opacity: 0.08 + Math.sin(t * Math.PI * 2 + 2) * 0.08,
});

// Star twinkles
const star1Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4) * 0.5;
  return {
    cx: petUnitsToPx(30, size),
    cy: petUnitsToPx(30, size),
    r: petUnitsToPx(1 * s + 0.5, size),
    opacity: s,
  };
};
const star2Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4 + 1.4) * 0.5;
  return {
    cx: petUnitsToPx(42, size),
    cy: petUnitsToPx(34, size),
    r: petUnitsToPx(0.8 * s + 0.3, size),
    opacity: s,
  };
};
const star3Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4 + 2.8) * 0.5;
  return {
    cx: petUnitsToPx(35, size),
    cy: petUnitsToPx(40, size),
    r: petUnitsToPx(0.6 * s + 0.2, size),
    opacity: s,
  };
};

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

export const CrystalPet = memo<PetProps>(({ size }) => (
  <PetFloat size={size} durationMs={FLOAT_MS}>
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
      <Defs>
        <RadialGradient id="crystalGrad" cx="40%" cy="35%">
          <Stop offset="0%" stopColor="#c8b6ff" />
          <Stop offset="50%" stopColor="#7b68ee" />
          <Stop offset="100%" stopColor="#3d2b6e" />
        </RadialGradient>
      </Defs>
      {/* Base */}
      <Ellipse cx={36} cy={56} rx={14} ry={4} fill="#4a3d6e" />
      <Rect x={28} y={52} width={16} height={6} rx={2} fill="#5a4d7e" />
      {/* Ball */}
      <Circle cx={36} cy={36} r={16} fill="url(#crystalGrad)" />
    </Svg>
    {/* Inner nebula */}
    <LoopDot sample={nebula1Sampler} size={size} durationMs={LOOP_MS} color={NEBULA1_FILL} />
    <LoopDot sample={nebula2Sampler} size={size} durationMs={LOOP_MS} color={NEBULA2_FILL} />
    {/* Stars inside */}
    <LoopDot sample={star1Sampler} size={size} durationMs={LOOP_MS} color={STAR_FILL} />
    <LoopDot sample={star2Sampler} size={size} durationMs={LOOP_MS} color={STAR_FILL} />
    <LoopDot sample={star3Sampler} size={size} durationMs={LOOP_MS} color={STAR_FILL} />
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      {/* Highlight */}
      <Ellipse
        cx={30}
        cy={28}
        rx={5}
        ry={3}
        fill="rgba(255,255,255,0.25)"
        rotation={-30}
        origin="30, 28"
      />
    </Svg>
  </PetFloat>
));
CrystalPet.displayName = 'CrystalPet';
