/**
 * MeteorBuddyPet — meteor buddy
 *
 * Companion pet for the meteorStrike card-flip animation.
 * Brown meteor + gradient texture + flickering flame tail + cute face + craters + pulsing halo.
 * Each flame tongue is a static ellipse stretched vertically (scaleY = ry / base ry) and faded by
 * a LoopLayer; the halo is a LoopRing breathing in opacity.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { type LayerSampler, LoopLayer, LoopRing, type RingSampler } from '@/components/loopMotion';

import { PetFloat } from './PetFloat';
import { PET_VIEWBOX, type PetProps, petUnitsToPx } from './PetProps';

const FLOAT_MS = 2000;
const FLAME_LOOP_MS = 800;
const PULSE_LOOP_MS = 2000;

/**
 * Flame tongues: `ry = ryBase + sin(t·2π + phase) · ryAmp`, `opacity = fBase + sin(…) · 0.3`.
 * `boxUnits` covers the tallest `ry` (ryBase + ryAmp) with margin.
 */
const FLAME_SEEDS = [
  {
    cx: 36,
    cy: 58,
    rx: 8,
    ryBase: 10,
    ryAmp: 1.5,
    fBase: 0.7,
    phase: 0,
    fill: '#ff6b35',
    boxUnits: 24,
  },
  {
    cx: 33,
    cy: 60,
    rx: 5,
    ryBase: 8,
    ryAmp: 1.2,
    fBase: 0.5,
    phase: 1,
    fill: '#ff9a3c',
    boxUnits: 20,
  },
  {
    cx: 39,
    cy: 59,
    rx: 4,
    ryBase: 7,
    ryAmp: 1,
    fBase: 0.4,
    phase: 2,
    fill: '#ffcc02',
    boxUnits: 18,
  },
] as const;

type FlameSeed = (typeof FLAME_SEEDS)[number];

const GLOW_RING = { cx: 36, cy: 34, r: 18, strokeWidth: 0.5 } as const;
const GLOW_STROKE = '#ff9a3c';

const PET_VIEWBOX_ATTR = `0 0 ${PET_VIEWBOX} ${PET_VIEWBOX}`;

// Flame flicker — opacity + scaleY effect via ry
const FLAME_SAMPLERS: readonly LayerSampler[] = FLAME_SEEDS.map((seed) => (t, size) => {
  const f = seed.fBase + Math.sin(t * Math.PI * 2 + seed.phase) * 0.3;
  const ry = seed.ryBase + Math.sin(t * Math.PI * 2 + seed.phase) * seed.ryAmp;
  return {
    x: petUnitsToPx(seed.cx, size),
    y: petUnitsToPx(seed.cy, size),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: ry / seed.ryBase,
    opacity: f,
  };
});

// Glow ring pulse
const glowRingSampler: RingSampler = (t, size) => ({
  cx: petUnitsToPx(GLOW_RING.cx, size),
  cy: petUnitsToPx(GLOW_RING.cy, size),
  r: petUnitsToPx(GLOW_RING.r, size),
  strokeWidth: petUnitsToPx(GLOW_RING.strokeWidth, size),
  opacity: 0.2 + Math.sin(t * Math.PI * 2) * 0.15,
});

function centredViewBox(centre: { cx: number; cy: number }, boxUnits: number): string {
  return `${centre.cx - boxUnits / 2} ${centre.cy - boxUnits / 2} ${boxUnits} ${boxUnits}`;
}

function FlameArt({ seed, box }: { seed: FlameSeed; box: number }) {
  return (
    <Svg width={box} height={box} viewBox={centredViewBox(seed, seed.boxUnits)}>
      <Ellipse cx={seed.cx} cy={seed.cy} rx={seed.rx} ry={seed.ryBase} fill={seed.fill} />
    </Svg>
  );
}

export const MeteorBuddyPet = memo<PetProps>(({ size }) => (
  <PetFloat size={size} durationMs={FLOAT_MS}>
    {/* Flame tail */}
    {FLAME_SEEDS.map((seed, i) => {
      const box = petUnitsToPx(seed.boxUnits, size);
      return (
        <LoopLayer
          key={`flame-${seed.fill}`}
          sample={FLAME_SAMPLERS[i]!}
          size={size}
          durationMs={FLAME_LOOP_MS}
          width={box}
          height={box}
        >
          <FlameArt seed={seed} box={box} />
        </LoopLayer>
      );
    })}
    <Svg width={size} height={size} viewBox={PET_VIEWBOX_ATTR} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="meteorGrad" cx="35%" cy="30%">
          <Stop offset="0%" stopColor="#c4a882" />
          <Stop offset="100%" stopColor="#6b5340" />
        </RadialGradient>
      </Defs>
      {/* Meteor body */}
      <Circle cx={36} cy={34} r={16} fill="url(#meteorGrad)" />
      {/* Craters */}
      <Circle cx={30} cy={38} r={3} fill="rgba(0,0,0,0.15)" />
      <Circle cx={42} cy={32} r={2} fill="rgba(0,0,0,0.1)" />
      <Circle cx={34} cy={44} r={2} fill="rgba(0,0,0,0.1)" />
      {/* Face */}
      <Circle cx={31} cy={31} r={2.5} fill="#fff" />
      <Circle cx={41} cy={31} r={2.5} fill="#fff" />
      <Circle cx={31.5} cy={31} r={1.5} fill="#1a1a2e" />
      <Circle cx={41.5} cy={31} r={1.5} fill="#1a1a2e" />
      <Path
        d="M34 36 Q36 38 38 36"
        stroke="#4a3628"
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
    {/* Glow ring */}
    <LoopRing sample={glowRingSampler} size={size} durationMs={PULSE_LOOP_MS} color={GLOW_STROKE} />
  </PetFloat>
));
MeteorBuddyPet.displayName = 'MeteorBuddyPet';
