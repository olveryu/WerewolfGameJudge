/** 漩涡眼 (vortex collapse reveal): a one-eyed blob with a spinning iris and wriggling tentacles. */
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

const FLOAT_MS = 2500;
const SPIN_LOOP_MS = 3000;
const WOBBLE_LOOP_MS = 2000;
const TENTACLE_VARIANTS = 8;
const IRIS_BOX_UNITS = 16;
const IRIS = { cx: 36, cy: 36 } as const;

const irisSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(IRIS.cx, size),
  y: petUnitsToPx(IRIS.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function tentaclePaths(t: number): readonly string[] {
  const wobble = (phase: number) => Math.sin(t * Math.PI * 2 + phase) * 3;
  const [w1, w2, w3, w4] = [wobble(0), wobble(0.6), wobble(1.2), wobble(1.8)];
  return [
    `M22 48 Q${18 + w1} 56 ${22 + w1} 58`,
    `M28 50 Q${26 + w2} 58 ${30 + w2} 60`,
    `M44 50 Q${46 + w3} 58 ${42 + w3} 60`,
    `M50 48 Q${54 + w4} 56 ${50 + w4} 58`,
  ];
}

const tentacleArt = morphPaths((k) => tentaclePaths(k / TENTACLE_VARIANTS), null, {
  color: '#6a1b9a',
  width: 2.5,
  cap: 'round',
});

const bodyArt = petSvg('<ellipse cx="36" cy="40" rx="18" ry="14" fill="#4a148c"/>');

const eyeArt = petSvg(`
  <circle cx="36" cy="36" r="12" fill="#e8e0f0"/>
  <circle cx="36" cy="36" r="10" fill="#fff"/>`);

const irisArt = boxSvg(
  IRIS,
  IRIS_BOX_UNITS,
  `<circle cx="36" cy="36" r="7" fill="#7b1fa2"/>
  <path d="M36 29 Q40 33 36 36 Q32 33 36 29" fill="#9c27b0" opacity="0.7"/>
  <path d="M43 36 Q39 40 36 36 Q39 32 43 36" fill="#9c27b0" opacity="0.7"/>
  <path d="M36 43 Q32 39 36 36 Q40 39 36 43" fill="#9c27b0" opacity="0.7"/>
  <path d="M29 36 Q33 32 36 36 Q33 40 29 36" fill="#9c27b0" opacity="0.7"/>`,
);

const pupilArt = petSvg(`
  <circle cx="36" cy="36" r="3" fill="#1a1a2e"/>
  <circle cx="37" cy="35" r="1" fill="#fff"/>`);

export const vortexEyePet: DecorationSpec = {
  id: 'vortexCollapse',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      {
        kind: 'morph',
        sample: opaqueMorph,
        durationMs: WOBBLE_LOOP_MS,
        variantCount: TENTACLE_VARIANTS,
        mode: 'stacked',
        art: tentacleArt,
      },
      { kind: 'svg', art: eyeArt },
      boxLayer(irisSampler, SPIN_LOOP_MS, IRIS_BOX_UNITS, irisArt),
      { kind: 'svg', art: pupilArt },
    ]),
  ],
};
