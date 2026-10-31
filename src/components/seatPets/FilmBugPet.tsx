/**
 * FilmBugPet — Film Bug
 *
 * Companion pet for the filmRewind flip animation.
 * Film-strip-shaped bug + sprocket holes + golden eyes + antennae + 4 legs that twitch alternately.
 * Each leg is a LoopLine whose foot end moves while the hip stays fixed.
 */
import { memo } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { type LineSampler, LoopLine } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 3000;
const LOOP_MS = 1200;

const LEG_STROKE = '#3d3d3d';
const LEG_STROKE_WIDTH = 2;

function legFrame(
  size: number,
  hip: { x1: number; y1: number },
  foot: { x2: number; y2: number },
  dx: number,
) {
  return {
    x1: petUnitsToPx(hip.x1, size),
    y1: petUnitsToPx(hip.y1, size),
    x2: petUnitsToPx(foot.x2 + dx, size),
    y2: petUnitsToPx(foot.y2 + dx, size),
    strokeWidth: petUnitsToPx(LEG_STROKE_WIDTH, size),
    opacity: 1,
  };
}

// Left legs pull
const legL1Sampler: LineSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2) * -2;
  return legFrame(size, { x1: 26, y1: 50 }, { x2: 24, y2: 58 }, dx);
};
const legL2Sampler: LineSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2) * -2;
  return legFrame(size, { x1: 32, y1: 50 }, { x2: 30, y2: 58 }, dx);
};
// Right legs pull (offset phase)
const legR1Sampler: LineSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2 + Math.PI) * 2;
  return legFrame(size, { x1: 40, y1: 50 }, { x2: 42, y2: 58 }, dx);
};
const legR2Sampler: LineSampler = (t, size) => {
  const dx = Math.sin(t * Math.PI * 2 + Math.PI) * 2;
  return legFrame(size, { x1: 46, y1: 50 }, { x2: 48, y2: 58 }, dx);
};

export const FilmBugPet = memo<PetProps>(({ size }) => (
  <PetFloat size={size} durationMs={FLOAT_MS}>
    <Svg width={size} height={size} viewBox={`0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`}>
      {/* Film strip body */}
      <Rect x={20} y={26} width={32} height={24} rx={4} fill="#3d3d3d" />
      {/* Sprocket holes — top */}
      <Rect x={22} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={28} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={34} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={40} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={46} y={27} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      {/* Sprocket holes — bottom */}
      <Rect x={22} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={28} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={34} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={40} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      <Rect x={46} y={46} width={3} height={3} rx={0.5} fill="#1a1a1a" />
      {/* Frame window */}
      <Rect x={24} y={32} width={24} height={12} rx={1} fill="#5a4a3a" />
      {/* Face on frame */}
      <Circle cx={32} cy={37} r={2} fill="#ffd700" />
      <Circle cx={40} cy={37} r={2} fill="#ffd700" />
      <Circle cx={32} cy={37} r={1} fill="#1a1a2e" />
      <Circle cx={40} cy={37} r={1} fill="#1a1a2e" />
      <Path d="M34 40 Q36 41.5 38 40" stroke="#ffd700" strokeWidth={0.8} fill="none" />
      {/* Antennae */}
      <Line x1={30} y1={26} x2={28} y2={18} stroke="#5a5a5a" strokeWidth={1} />
      <Circle cx={28} cy={17} r={2} fill="#ffd700" />
      <Line x1={42} y1={26} x2={44} y2={18} stroke="#5a5a5a" strokeWidth={1} />
      <Circle cx={44} cy={17} r={2} fill="#ffd700" />
    </Svg>
    {/* Legs — left pair */}
    <LoopLine sample={legL1Sampler} size={size} durationMs={LOOP_MS} color={LEG_STROKE} />
    <LoopLine sample={legL2Sampler} size={size} durationMs={LOOP_MS} color={LEG_STROKE} />
    {/* Legs — right pair */}
    <LoopLine sample={legR1Sampler} size={size} durationMs={LOOP_MS} color={LEG_STROKE} />
    <LoopLine sample={legR2Sampler} size={size} durationMs={LOOP_MS} color={LEG_STROKE} />
  </PetFloat>
));
FilmBugPet.displayName = 'FilmBugPet';
