/** 印兽 (seal break reveal): a beast on a talisman whose rune and eyes glow. */
import type { DecorationSpec, DotSampler } from '@/scene/decoration';

import { PET_TEXT_FONT, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 3000;
const LOOP_MS = 2500;
const EYE_FILL = '#ffd700';

function pulseSampler(
  cx: number,
  cy: number,
  r: number,
  base: number,
  amplitude: number,
  phase: number,
) {
  const sampler: DotSampler = (t, size) => ({
    cx: petUnitsToPx(cx, size),
    cy: petUnitsToPx(cy, size),
    r: petUnitsToPx(r, size),
    opacity: base + Math.sin(t * Math.PI * 2 + phase) * amplitude,
  });
  return sampler;
}

const talismanArt = petSvg(`
  <rect x="22" y="42" width="28" height="20" rx="2" fill="#f5e6c8" stroke="#c4956a" stroke-width="1"/>
  <text x="36" y="55" text-anchor="middle" font-size="10" font-weight="bold" font-family="${PET_TEXT_FONT}" fill="#8b0000">封</text>`);

const beastArt = petSvg(`
  <ellipse cx="36" cy="36" rx="12" ry="10" fill="#6c7b95"/>
  <circle cx="36" cy="26" r="10" fill="#7b8da8"/>
  <polygon points="36,14 33,22 39,22" fill="#a8c4d8"/>`);

const faceArt = petSvg(`
  <circle cx="32" cy="24" r="1.2" fill="#1a1a2e"/>
  <circle cx="40" cy="24" r="1.2" fill="#1a1a2e"/>
  <path d="M33 29 Q36 31 39 29" stroke="#4a5568" stroke-width="0.8" fill="none"/>`);

export const sealBeastPet: DecorationSpec = {
  id: 'sealBreak',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: talismanArt },
      {
        kind: 'dot',
        sample: pulseSampler(36, 48, 14, 0.3, 0.3, 1),
        durationMs: LOOP_MS,
        color: 'rgba(200,0,0,0.1)',
      },
      { kind: 'svg', art: beastArt },
      {
        kind: 'dot',
        sample: pulseSampler(32, 24, 2.5, 0.6, 0.4, 0),
        durationMs: LOOP_MS,
        color: EYE_FILL,
      },
      {
        kind: 'dot',
        sample: pulseSampler(40, 24, 2.5, 0.6, 0.4, 1),
        durationMs: LOOP_MS,
        color: EYE_FILL,
      },
      { kind: 'svg', art: faceArt },
    ]),
  ],
};
