/** 刮刮猫 (scratch reveal): a lucky cat swiping a gold coin with its paw. */
import type { DecorationSpec, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, PET_TEXT_FONT, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2800;
const LOOP_MS = 1500;
const PAW_BOX_UNITS = 12;
const PAW = { cx: 22, cy: 46 } as const;

/** Paw swipe: up and down by three units. */
const pawSampler: LayerSampler = (t, size) => ({
  x: petUnitsToPx(PAW.cx, size),
  y: petUnitsToPx(PAW.cy - Math.sin(t * Math.PI * 2) * 3, size),
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const bodyArt = petSvg(`
  <ellipse cx="36" cy="50" rx="14" ry="10" fill="#f5deb3"/>
  <circle cx="36" cy="32" r="14" fill="#ffe4b5"/>
  <polygon points="24,22 20,10 30,18" fill="#ffcc80"/>
  <polygon points="48,22 52,10 42,18" fill="#ffcc80"/>
  <polygon points="25,21 22,13 29,18" fill="#ffb6c1"/>
  <polygon points="47,21 50,13 43,18" fill="#ffb6c1"/>
  <ellipse cx="31" cy="30" rx="2.5" ry="3" fill="#2d4a1b"/>
  <ellipse cx="41" cy="30" rx="2.5" ry="3" fill="#2d4a1b"/>
  <circle cx="31.5" cy="29.5" r="0.8" fill="#fff"/>
  <circle cx="41.5" cy="29.5" r="0.8" fill="#fff"/>
  <ellipse cx="36" cy="35" rx="2" ry="1.5" fill="#ffb6c1"/>
  <path d="M34 36.5 Q36 38 38 36.5" stroke="#c48a6e" stroke-width="0.8" fill="none"/>
  <line x1="18" y1="33" x2="28" y2="34" stroke="#c4a882" stroke-width="0.5"/>
  <line x1="18" y1="36" x2="28" y2="36" stroke="#c4a882" stroke-width="0.5"/>
  <line x1="54" y1="33" x2="44" y2="34" stroke="#c4a882" stroke-width="0.5"/>
  <line x1="54" y1="36" x2="44" y2="36" stroke="#c4a882" stroke-width="0.5"/>`);

const pawArt = boxSvg(
  PAW,
  PAW_BOX_UNITS,
  `<ellipse cx="${PAW.cx}" cy="${PAW.cy}" rx="5" ry="4" fill="#ffe4b5"/>`,
);

const coinArt = petSvg(`
  <circle cx="18" cy="42" r="5" fill="#ffd700" stroke="#daa520" stroke-width="1"/>
  <text x="18" y="44" text-anchor="middle" font-size="6" font-weight="bold" font-family="${PET_TEXT_FONT}" fill="#b8860b">¥</text>`);

export const scratchCatPet: DecorationSpec = {
  id: 'scratch',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      boxLayer(pawSampler, LOOP_MS, PAW_BOX_UNITS, pawArt),
      { kind: 'svg', art: coinArt },
    ]),
  ],
};
