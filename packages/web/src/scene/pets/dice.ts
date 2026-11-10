/** 骰灵 (roulette reveal): a dice spirit with a blinking eye and a golden sparkle. */
import type { DecorationSpec, DotSampler } from '@/scene/decoration';

import { petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2500;
const LOOP_MS = 3000;
const EYE_FILL = '#2d1b4e';

const leftEyeSampler: DotSampler = (t, size) => ({
  cx: petUnitsToPx(31, size),
  cy: petUnitsToPx(23, size),
  r: petUnitsToPx(2.5, size),
  opacity: 0.6 + Math.sin(t * Math.PI * 2) * 0.4,
});

const sparkleSampler: DotSampler = (t, size) => {
  const s = 0.8 + Math.sin(t * Math.PI * 4) * 0.5;
  return {
    cx: petUnitsToPx(52, size),
    cy: petUnitsToPx(16, size),
    r: petUnitsToPx(1.5 * s, size),
    opacity: 0.5 + Math.sin(t * Math.PI * 4) * 0.5,
  };
};

const bodyArt = petSvg(`
  <rect x="18" y="18" width="36" height="36" rx="6" fill="#e8e0f0" stroke="#9b8ec4" stroke-width="1.5"/>
  <circle cx="28" cy="28" r="3" fill="#4a3d6e"/>
  <circle cx="44" cy="28" r="3" fill="#4a3d6e"/>
  <circle cx="36" cy="36" r="3" fill="#4a3d6e"/>
  <circle cx="28" cy="44" r="3" fill="#4a3d6e"/>
  <circle cx="44" cy="44" r="3" fill="#4a3d6e"/>`);

const faceArt = petSvg(`
  <ellipse cx="41" cy="23" rx="2" ry="2.5" fill="${EYE_FILL}"/>
  <path d="M33 26 Q36 28.5 39 26" stroke="${EYE_FILL}" stroke-width="1" fill="none" stroke-linecap="round"/>`);

export const dicePet: DecorationSpec = {
  id: 'roulette',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      { kind: 'dot', sample: leftEyeSampler, durationMs: LOOP_MS, color: EYE_FILL },
      { kind: 'svg', art: faceArt },
      { kind: 'dot', sample: sparkleSampler, durationMs: LOOP_MS, color: '#ffd700' },
    ]),
  ],
};
