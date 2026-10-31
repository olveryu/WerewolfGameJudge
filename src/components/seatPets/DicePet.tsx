/**
 * DicePet - Dice spirit
 *
 * Companion pet for roulette card-flip animation.
 * White-purple rounded dice + cute big eyes + golden sparkle twinkle, slowly floating.
 * The blinking left eye and the sparkle are LoopDots.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2500;
const LOOP_MS = 3000;

const EYE_FILL = '#2d1b4e';
const SPARKLE_FILL = '#ffd700';

// Eye blink pulse
const leftEyeSampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(31, size),
  cy: petUnitsToPx(23, size),
  r: petUnitsToPx(2.5, size),
  opacity: 0.6 + Math.sin(t * Math.PI * 2) * 0.4,
});

// Sparkle twinkle
const sparkleSampler: DotSampler = (t, size) => {
  const s = 0.8 + Math.sin(t * Math.PI * 4) * 0.5;
  return {
    cx: petUnitsToPx(52, size),
    cy: petUnitsToPx(16, size),
    r: petUnitsToPx(1.5 * s, size),
    opacity: 0.5 + Math.sin(t * Math.PI * 4) * 0.5,
  };
};

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

export const DicePet = memo<PetProps>(({ size }) => (
  <PetFloat size={size} durationMs={FLOAT_MS}>
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
      {/* Dice body */}
      <Rect
        x={18}
        y={18}
        width={36}
        height={36}
        rx={6}
        fill="#e8e0f0"
        stroke="#9b8ec4"
        strokeWidth={1.5}
      />
      {/* Face dots */}
      <Circle cx={28} cy={28} r={3} fill="#4a3d6e" />
      <Circle cx={44} cy={28} r={3} fill="#4a3d6e" />
      <Circle cx={36} cy={36} r={3} fill="#4a3d6e" />
      <Circle cx={28} cy={44} r={3} fill="#4a3d6e" />
      <Circle cx={44} cy={44} r={3} fill="#4a3d6e" />
    </Svg>
    {/* Cute eyes on top face */}
    <LoopDot sample={leftEyeSampler} size={size} durationMs={LOOP_MS} color={EYE_FILL} />
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      <Ellipse cx={41} cy={23} rx={2} ry={2.5} fill={EYE_FILL} />
      <Path
        d="M33 26 Q36 28.5 39 26"
        stroke={EYE_FILL}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
    {/* Sparkle */}
    <LoopDot sample={sparkleSampler} size={size} durationMs={LOOP_MS} color={SPARKLE_FILL} />
  </PetFloat>
));
DicePet.displayName = 'DicePet';
