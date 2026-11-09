/** 牌灵 (card pick reveal): a sprite on a playing card, wings wobbling and sparkles twinkling. */
import type { DecorationSpec, DotSampler, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, PET_TEXT_FONT, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2700;
const LOOP_MS = 1500;
const WING_BOX_UNITS = 16;
const LEFT_WING = { cx: 25, cy: 22 } as const;
const RIGHT_WING = { cx: 47, cy: 22 } as const;
const WING_FILL = 'rgba(168,230,207,0.6)';
const SPARKLE_FILL = '#ffd700';

function wingSampler(wing: { cx: number; cy: number }, phase: number): LayerSampler {
  return (t, size) => ({
    x: petUnitsToPx(wing.cx, size),
    y: petUnitsToPx(wing.cy, size),
    rotateDeg: Math.sin(t * Math.PI * 2 + phase) * 8,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  });
}

function sparkleSampler(cx: number, cy: number, r: number, base: number, phase: number) {
  const sampler: DotSampler = (t, size) => {
    const s = 0.5 + Math.sin(t * Math.PI * 4 + phase) * 0.5;
    return {
      cx: petUnitsToPx(cx, size),
      cy: petUnitsToPx(cy, size),
      r: petUnitsToPx(r * s + base, size),
      opacity: s,
    };
  };
  return sampler;
}

const bodyArt = petSvg(`
  <rect x="22" y="28" width="28" height="38" rx="4" fill="#f0e6d3" stroke="#c4a882" stroke-width="1"/>
  <text x="36" y="52" text-anchor="middle" font-size="16" font-family="${PET_TEXT_FONT}" fill="#8b0000">♠</text>
  <circle cx="36" cy="22" r="10" fill="#a8e6cf"/>
  <circle cx="33" cy="20" r="2" fill="#1a1a2e"/>
  <circle cx="39" cy="20" r="2" fill="#1a1a2e"/>
  <circle cx="33.5" cy="19.5" r="0.6" fill="#fff"/>
  <circle cx="39.5" cy="19.5" r="0.6" fill="#fff"/>
  <path d="M33 24 Q36 26.5 39 24" stroke="#1a1a2e" stroke-width="0.8" fill="none" stroke-linecap="round"/>`);

const wingArt = (wing: { cx: number; cy: number }) =>
  boxSvg(
    wing,
    WING_BOX_UNITS,
    `<ellipse cx="${wing.cx}" cy="${wing.cy}" rx="4" ry="6" fill="${WING_FILL}"/>`,
  );

export const cardSpritePet: DecorationSpec = {
  id: 'cardPick',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      boxLayer(wingSampler(LEFT_WING, 0), LOOP_MS, WING_BOX_UNITS, wingArt(LEFT_WING)),
      boxLayer(wingSampler(RIGHT_WING, 0.6), LOOP_MS, WING_BOX_UNITS, wingArt(RIGHT_WING)),
      {
        kind: 'dot',
        sample: sparkleSampler(50, 14, 1.2, 0.3, 0),
        durationMs: LOOP_MS,
        color: SPARKLE_FILL,
      },
      {
        kind: 'dot',
        sample: sparkleSampler(22, 16, 1.0, 0.2, 1),
        durationMs: LOOP_MS,
        color: SPARKLE_FILL,
      },
    ]),
  ],
};
