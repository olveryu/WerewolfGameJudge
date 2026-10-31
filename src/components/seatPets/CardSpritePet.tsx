/**
 * CardSpritePet — card sprite
 *
 * Companion pet for the cardPick flip animation.
 * A green sprite sits on a playing card with gentle wing wobble + sparkle twinkle.
 * Each wing is a static ellipse rotated about its own centre by a LoopLayer; sparkles are LoopDots.
 */
import { memo } from 'react';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2700;
const LOOP_MS = 1500;

/** Wing ellipses (rx 4, ry 6) pivot on their own centre; box 16 covers ry at any angle. */
const WING_BOX_UNITS = 16;
const LEFT_WING = { cx: 25, cy: 22 } as const;
const RIGHT_WING = { cx: 47, cy: 22 } as const;
const WING_FILL = 'rgba(168,230,207,0.6)';
const SPARKLE_FILL = '#ffd700';

// Wing wobble
const leftWingSampler: LayerSampler = (t, size) => {
  const rot = Math.sin(t * Math.PI * 2) * 8;
  return {
    x: petUnitsToPx(LEFT_WING.cx, size),
    y: petUnitsToPx(LEFT_WING.cy, size),
    rotateDeg: rot,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};
const rightWingSampler: LayerSampler = (t, size) => {
  const rot = Math.sin(t * Math.PI * 2 + 0.6) * 8;
  return {
    x: petUnitsToPx(RIGHT_WING.cx, size),
    y: petUnitsToPx(RIGHT_WING.cy, size),
    rotateDeg: rot,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

// Sparkle twinkle
const sparkle1Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4) * 0.5;
  return {
    cx: petUnitsToPx(50, size),
    cy: petUnitsToPx(14, size),
    r: petUnitsToPx(1.2 * s + 0.3, size),
    opacity: s,
  };
};
const sparkle2Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4 + 1) * 0.5;
  return {
    cx: petUnitsToPx(22, size),
    cy: petUnitsToPx(16, size),
    r: petUnitsToPx(1.0 * s + 0.2, size),
    opacity: s,
  };
};

function wingViewBox(wing: { cx: number; cy: number }): string {
  return `${wing.cx - WING_BOX_UNITS / 2} ${wing.cy - WING_BOX_UNITS / 2} ${WING_BOX_UNITS} ${WING_BOX_UNITS}`;
}

export const CardSpritePet = memo<PetProps>(({ size }) => {
  const wingBox = petUnitsToPx(WING_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={`0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`}>
        {/* Card base */}
        <Rect
          x={22}
          y={28}
          width={28}
          height={38}
          rx={4}
          fill="#f0e6d3"
          stroke="#c4a882"
          strokeWidth={1}
        />
        <SvgText x={36} y={52} textAnchor="middle" fontSize={16} fill="#8b0000">
          ♠
        </SvgText>
        {/* Sprite sitting on card */}
        <Circle cx={36} cy={22} r={10} fill="#a8e6cf" />
        {/* Eyes */}
        <Circle cx={33} cy={20} r={2} fill="#1a1a2e" />
        <Circle cx={39} cy={20} r={2} fill="#1a1a2e" />
        <Circle cx={33.5} cy={19.5} r={0.6} fill="#fff" />
        <Circle cx={39.5} cy={19.5} r={0.6} fill="#fff" />
        {/* Smile */}
        <Path
          d="M33 24 Q36 26.5 39 24"
          stroke="#1a1a2e"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      {/* Wings */}
      <LoopLayer
        sample={leftWingSampler}
        size={size}
        durationMs={LOOP_MS}
        width={wingBox}
        height={wingBox}
      >
        <Svg width={wingBox} height={wingBox} viewBox={wingViewBox(LEFT_WING)}>
          <Ellipse cx={LEFT_WING.cx} cy={LEFT_WING.cy} rx={4} ry={6} fill={WING_FILL} />
        </Svg>
      </LoopLayer>
      <LoopLayer
        sample={rightWingSampler}
        size={size}
        durationMs={LOOP_MS}
        width={wingBox}
        height={wingBox}
      >
        <Svg width={wingBox} height={wingBox} viewBox={wingViewBox(RIGHT_WING)}>
          <Ellipse cx={RIGHT_WING.cx} cy={RIGHT_WING.cy} rx={4} ry={6} fill={WING_FILL} />
        </Svg>
      </LoopLayer>
      {/* Sparkles */}
      <LoopDot sample={sparkle1Sampler} size={size} durationMs={LOOP_MS} color={SPARKLE_FILL} />
      <LoopDot sample={sparkle2Sampler} size={size} durationMs={LOOP_MS} color={SPARKLE_FILL} />
    </PetFloat>
  );
});
CardSpritePet.displayName = 'CardSpritePet';
