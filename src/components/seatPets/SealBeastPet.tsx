/**
 * SealBeastPet — Seal Beast
 *
 * Companion pet for the sealBreak flip animation.
 * Gray-blue stone beast + single horn + pulsing golden eyes + talisman paper underfoot + flickering "封" glyph.
 * The rune glow and both eyes are LoopDots breathing in opacity.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { type DotSampler, LoopDot } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 3000;
const LOOP_MS = 2500;

const RUNE_GLOW = { cx: 36, cy: 48, r: 14 } as const;
const RUNE_GLOW_FILL = 'rgba(200,0,0,0.1)';
const LEFT_EYE = { cx: 32, cy: 24, r: 2.5 } as const;
const RIGHT_EYE = { cx: 40, cy: 24, r: 2.5 } as const;
const EYE_FILL = '#ffd700';

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

// Eye glow pulse
const leftEyeSampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(LEFT_EYE.cx, size),
  cy: petUnitsToPx(LEFT_EYE.cy, size),
  r: petUnitsToPx(LEFT_EYE.r, size),
  opacity: 0.6 + Math.sin(t * Math.PI * 2) * 0.4,
});
const rightEyeSampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(RIGHT_EYE.cx, size),
  cy: petUnitsToPx(RIGHT_EYE.cy, size),
  r: petUnitsToPx(RIGHT_EYE.r, size),
  opacity: 0.6 + Math.sin(t * Math.PI * 2 + 1) * 0.4,
});

// Rune glow
const runeGlowSampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(RUNE_GLOW.cx, size),
  cy: petUnitsToPx(RUNE_GLOW.cy, size),
  r: petUnitsToPx(RUNE_GLOW.r, size),
  opacity: 0.3 + Math.sin(t * Math.PI * 2 + 1) * 0.3,
});

export const SealBeastPet = memo<PetProps>(({ size }) => (
  <PetFloat size={size} durationMs={FLOAT_MS}>
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
      {/* Seal/talisman paper */}
      <Rect
        x={22}
        y={42}
        width={28}
        height={20}
        rx={2}
        fill="#f5e6c8"
        stroke="#c4956a"
        strokeWidth={1}
      />
      {/* Rune symbol */}
      <SvgText x={36} y={55} textAnchor="middle" fontSize={10} fill="#8b0000" fontWeight="bold">
        封
      </SvgText>
    </Svg>
    <LoopDot sample={runeGlowSampler} size={size} durationMs={LOOP_MS} color={RUNE_GLOW_FILL} />
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      {/* Beast body */}
      <Ellipse cx={36} cy={36} rx={12} ry={10} fill="#6c7b95" />
      {/* Head */}
      <Circle cx={36} cy={26} r={10} fill="#7b8da8" />
      {/* Horn */}
      <Polygon points="36,14 33,22 39,22" fill="#a8c4d8" />
    </Svg>
    {/* Eyes */}
    <LoopDot sample={leftEyeSampler} size={size} durationMs={LOOP_MS} color={EYE_FILL} />
    <LoopDot sample={rightEyeSampler} size={size} durationMs={LOOP_MS} color={EYE_FILL} />
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      <Circle cx={32} cy={24} r={1.2} fill="#1a1a2e" />
      <Circle cx={40} cy={24} r={1.2} fill="#1a1a2e" />
      {/* Mouth */}
      <Path d="M33 29 Q36 31 39 29" stroke="#4a5568" strokeWidth={0.8} fill="none" />
    </Svg>
  </PetFloat>
));
SealBeastPet.displayName = 'SealBeastPet';
