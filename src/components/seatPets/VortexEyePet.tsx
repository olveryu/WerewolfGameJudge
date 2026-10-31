/**
 * VortexEyePet — Vortex Eye.
 *
 * Companion pet for the vortexCollapse flip animation.
 * Deep-purple blob body + tentacle wobble + big eye + continuously rotating vortex iris + pupil highlight.
 * The tentacle wobble is a path morph rendered as cross-faded static variants by one LoopMorph;
 * the iris is a static swirl group rotated by a LoopLayer.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import {
  type LayerSampler,
  LoopLayer,
  LoopMorph,
  type MorphSampler,
} from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2500;
const SPIN_LOOP_MS = 3000;
const WOBBLE_LOOP_MS = 2000;
/** Static tentacle poses per 2 s wobble; 8 keeps each cross-fade at 250 ms. */
const TENTACLE_VARIANTS = 8;

/** Iris disc (r 7) → box 16 contains it at any angle. */
const IRIS_BOX_UNITS = 16;
const IRIS = { cx: 36, cy: 36 } as const;
const TENTACLE_STROKE = '#6a1b9a';

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

// Vortex iris spin
const irisSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(IRIS.cx, size),
  y: petUnitsToPx(IRIS.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

// Tentacle wobble
function tentaclePaths(t: number): readonly string[] {
  const w1 = Math.sin(t * Math.PI * 2) * 3;
  const w2 = Math.sin(t * Math.PI * 2 + 0.6) * 3;
  const w3 = Math.sin(t * Math.PI * 2 + 1.2) * 3;
  const w4 = Math.sin(t * Math.PI * 2 + 1.8) * 3;
  return [
    `M22 48 Q${18 + w1} 56 ${22 + w1} 58`,
    `M28 50 Q${26 + w2} 58 ${30 + w2} 60`,
    `M44 50 Q${46 + w3} 58 ${42 + w3} 60`,
    `M50 48 Q${54 + w4} 56 ${50 + w4} 58`,
  ];
}

const tentacleSampler: MorphSampler = () => ({ opacity: 1 });

const renderTentacles = (k: number, s: number) => (
  <Svg width={s} height={s} viewBox={PET_VIEWBOX_ATTR}>
    {tentaclePaths(k / TENTACLE_VARIANTS).map((d) => (
      <Path
        key={d}
        d={d}
        stroke={TENTACLE_STROKE}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
    ))}
  </Svg>
);

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

export const VortexEyePet = memo<PetProps>(({ size }) => {
  const irisBox = petUnitsToPx(IRIS_BOX_UNITS, size);
  return (
    <PetFloat size={size} durationMs={FLOAT_MS}>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR}>
        {/* Body blob */}
        <Ellipse cx={36} cy={40} rx={18} ry={14} fill="#4a148c" />
      </Svg>
      {/* Tentacles */}
      <LoopMorph
        sample={tentacleSampler}
        size={size}
        durationMs={WOBBLE_LOOP_MS}
        variantCount={TENTACLE_VARIANTS}
        mode="stacked"
        renderVariant={renderTentacles}
      />
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        {/* Big eye */}
        <Circle cx={36} cy={36} r={12} fill="#e8e0f0" />
        <Circle cx={36} cy={36} r={10} fill="#fff" />
      </Svg>
      {/* Vortex iris — spinning */}
      <LoopLayer
        sample={irisSampler}
        size={size}
        durationMs={SPIN_LOOP_MS}
        width={irisBox}
        height={irisBox}
      >
        <Svg width={irisBox} height={irisBox} viewBox={centredViewBox(IRIS, IRIS_BOX_UNITS)}>
          <Circle cx={36} cy={36} r={7} fill="#7b1fa2" />
          <Path d="M36 29 Q40 33 36 36 Q32 33 36 29" fill="#9c27b0" opacity={0.7} />
          <Path d="M43 36 Q39 40 36 36 Q39 32 43 36" fill="#9c27b0" opacity={0.7} />
          <Path d="M36 43 Q32 39 36 36 Q40 39 36 43" fill="#9c27b0" opacity={0.7} />
          <Path d="M29 36 Q33 32 36 36 Q33 40 29 36" fill="#9c27b0" opacity={0.7} />
        </Svg>
      </LoopLayer>
      <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
        {/* Pupil */}
        <Circle cx={36} cy={36} r={3} fill="#1a1a2e" />
        <Circle cx={37} cy={35} r={1} fill="#fff" />
      </Svg>
    </PetFloat>
  );
});
VortexEyePet.displayName = 'VortexEyePet';
