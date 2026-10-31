/**
 * LuckyStarPet - lucky star
 *
 * Companion pet for the fortuneWheel flip animation.
 * Gold five-pointed star + cute face + slow-spinning belly wheel + twinkling sparkles, floating.
 * The belly wheel is a static spoke group rotated by a LoopLayer; sparkles are LoopDots.
 */
import { memo } from 'react';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';

import { type DotSampler, type LayerSampler, LoopDot, LoopLayer } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2500;
const WHEEL_LOOP_MS = 6000;
const SPARKLE_LOOP_MS = 1500;

/** Wheel rim (r 5, stroke 1) → half-extent 5.5; box 12 contains it at any angle. */
const WHEEL_BOX_UNITS = 12;
const WHEEL = { cx: 36, cy: 38 } as const;
const WHEEL_STROKE = '#daa520';
const SPARKLE_FILL = '#fff';

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

/** Generate 5-point star polygon points */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
    pts.push(`${cx + Math.cos(outerAngle) * outer},${cy + Math.sin(outerAngle) * outer}`);
    pts.push(`${cx + Math.cos(innerAngle) * inner},${cy + Math.sin(innerAngle) * inner}`);
  }
  return pts.join(' ');
}

// Belly wheel spin
const wheelSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(WHEEL.cx, size),
  y: petUnitsToPx(WHEEL.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

// Sparkle twinkle
const sparkle1Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4) * 0.5;
  return {
    cx: petUnitsToPx(56, size),
    cy: petUnitsToPx(16, size),
    r: petUnitsToPx(1.5 * s + 0.3, size),
    opacity: s,
  };
};
const sparkle2Sampler: DotSampler = (t, size) => {
  const s = 0.5 + Math.sin(t * Math.PI * 4 + 1) * 0.5;
  return {
    cx: petUnitsToPx(18, size),
    cy: petUnitsToPx(18, size),
    r: petUnitsToPx(1.0 * s + 0.2, size),
    opacity: s,
  };
};

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

export const LuckyStarPet = memo<PetProps>(({ size }) => {
  const wheelBox = petUnitsToPx(WHEEL_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
        {/* Star body */}
        <Polygon
          points={starPoints(36, 36, 24, 10)}
          fill="#ffd700"
          stroke="#daa520"
          strokeWidth={1}
        />
        {/* Face */}
        <Circle cx={32} cy={30} r={2} fill="#8b6508" />
        <Circle cx={40} cy={30} r={2} fill="#8b6508" />
        <Path
          d="M33 34 Q36 36.5 39 34"
          stroke="#8b6508"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      {/* Mini wheel on belly */}
      <LoopLayer
        sample={wheelSampler}
        size={size}
        durationMs={WHEEL_LOOP_MS}
        width={wheelBox}
        height={wheelBox}
      >
        <Svg width={wheelBox} height={wheelBox} viewBox={centredViewBox(WHEEL, WHEEL_BOX_UNITS)}>
          <Circle cx={36} cy={38} r={5} fill="none" stroke={WHEEL_STROKE} strokeWidth={1} />
          <Line x1={36} y1={33} x2={36} y2={43} stroke={WHEEL_STROKE} strokeWidth={0.5} />
          <Line x1={31} y1={38} x2={41} y2={38} stroke={WHEEL_STROKE} strokeWidth={0.5} />
          <Line x1={32.5} y1={34.5} x2={39.5} y2={41.5} stroke={WHEEL_STROKE} strokeWidth={0.5} />
          <Line x1={39.5} y1={34.5} x2={32.5} y2={41.5} stroke={WHEEL_STROKE} strokeWidth={0.5} />
        </Svg>
      </LoopLayer>
      {/* Sparkles */}
      <LoopDot
        sample={sparkle1Sampler}
        size={size}
        durationMs={SPARKLE_LOOP_MS}
        color={SPARKLE_FILL}
      />
      <LoopDot
        sample={sparkle2Sampler}
        size={size}
        durationMs={SPARKLE_LOOP_MS}
        color={SPARKLE_FILL}
      />
    </PetFloat>
  );
});
LuckyStarPet.displayName = 'LuckyStarPet';
