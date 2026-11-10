/** 猎犬 (role hunt reveal): a hound with a magnifying glass, wobbling ears and a wagging tail. */
import type { DecorationSpec, LayerSampler } from '@/scene/decoration';

import {
  boxLayer,
  boxSvg,
  morphPaths,
  opaqueMorph,
  petFloat,
  petSvg,
  petUnitsToPx,
} from './petArt';

const FLOAT_MS = 3000;
const LOOP_MS = 2000;
const EAR_BOX_UNITS = 18;
const LEFT_EAR = { cx: 24, cy: 20 } as const;
const RIGHT_EAR = { cx: 48, cy: 20 } as const;
const EAR_FILL = '#a67a52';
const TAIL_VARIANTS = 8;
const TAIL_CYCLES_PER_LOOP = 2;

function earSampler(ear: { cx: number; cy: number }, tilt: number, phase: number): LayerSampler {
  return (t, size) => ({
    x: petUnitsToPx(ear.cx, size),
    y: petUnitsToPx(ear.cy, size),
    rotateDeg: tilt + Math.sin(t * Math.PI * 2 + phase) * 10,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  });
}

function tailPath(t: number): string {
  return `M52 46 Q58 38 ${56 + Math.sin(t * Math.PI * 4) * 6} 44`;
}

const bodyArt = petSvg(`
  <ellipse cx="36" cy="46" rx="16" ry="12" fill="#c4956a"/>
  <circle cx="36" cy="30" r="14" fill="#d4a574"/>`);

const earArt = (ear: { cx: number; cy: number }) =>
  boxSvg(
    ear,
    EAR_BOX_UNITS,
    `<ellipse cx="${ear.cx}" cy="${ear.cy}" rx="5" ry="8" fill="${EAR_FILL}"/>`,
  );

const faceArt = petSvg(`
  <circle cx="31" cy="28" r="3" fill="#2d1b1b"/>
  <circle cx="41" cy="28" r="3" fill="#2d1b1b"/>
  <circle cx="32" cy="27" r="1" fill="#fff"/>
  <circle cx="42" cy="27" r="1" fill="#fff"/>
  <ellipse cx="36" cy="33" rx="3" ry="2" fill="#3d2b1b"/>
  <circle cx="52" cy="38" r="6" fill="none" stroke="#7b8fa8" stroke-width="2"/>
  <circle cx="52" cy="38" r="4" fill="rgba(173,216,230,0.3)"/>
  <line x1="56" y1="42" x2="60" y2="48" stroke="#7b8fa8" stroke-width="2" stroke-linecap="round"/>`);

const tailArt = morphPaths((k) => [tailPath(k / TAIL_VARIANTS / TAIL_CYCLES_PER_LOOP)], null, {
  color: '#c4956a',
  width: 3,
  cap: 'round',
});

export const houndPet: DecorationSpec = {
  id: 'roleHunt',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      boxLayer(earSampler(LEFT_EAR, -15, 0), LOOP_MS, EAR_BOX_UNITS, earArt(LEFT_EAR)),
      boxLayer(earSampler(RIGHT_EAR, 15, 0.6), LOOP_MS, EAR_BOX_UNITS, earArt(RIGHT_EAR)),
      { kind: 'svg', art: faceArt },
      {
        kind: 'morph',
        sample: opaqueMorph,
        durationMs: LOOP_MS,
        variantCount: TAIL_VARIANTS,
        mode: 'stacked',
        cyclesPerLoop: TAIL_CYCLES_PER_LOOP,
        art: tailArt,
      },
    ]),
  ],
};
