/** 锁龙 (chain shatter reveal): a little dragon shaking its chains and flapping small wings. */
import type { DecorationSpec, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, petFloat, petSvg, petUnitsToPx } from './petArt';

const FLOAT_MS = 2800;
const CHAIN_LOOP_MS = 500;
const WING_LOOP_MS = 2000;
const CHAIN_BOX_UNITS = 12;
const CHAIN_LEFT = { cx: 22, cy: 38 } as const;
const CHAIN_RIGHT = { cx: 50, cy: 36 } as const;
const CHAIN_STROKE = '#a8a8a8';
const WING_BOX_UNITS = 10;
const LEFT_WING = { cx: 24, cy: 30 } as const;
const RIGHT_WING = { cx: 48, cy: 30 } as const;
const WING_FILL = 'rgba(107,166,106,0.5)';

/** Chain shake: a fast one-unit sideways oscillation. */
function chainSampler(link: { cx: number; cy: number }, phase: number): LayerSampler {
  return (t, size) => ({
    x: petUnitsToPx(link.cx + Math.sin(t * Math.PI * 2 + phase), size),
    y: petUnitsToPx(link.cy, size),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  });
}

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

const bodyArt = petSvg(`
  <ellipse cx="36" cy="44" rx="14" ry="12" fill="#5b8c5a"/>
  <path d="M50 44 Q58 36 56 44 Q54 50 52 46" stroke="#5b8c5a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="36" cy="28" r="12" fill="#6aa66a"/>
  <path d="M28 20 L24 12 L30 18" fill="#8bc48a"/>
  <path d="M44 20 L48 12 L42 18" fill="#8bc48a"/>
  <circle cx="32" cy="26" r="3" fill="#fff"/>
  <circle cx="40" cy="26" r="3" fill="#fff"/>
  <circle cx="33" cy="26" r="1.8" fill="#c0392b"/>
  <circle cx="41" cy="26" r="1.8" fill="#c0392b"/>
  <circle cx="34" cy="32" r="0.8" fill="#4a5568"/>
  <circle cx="38" cy="32" r="0.8" fill="#4a5568"/>`);

const chainLink = (link: { cx: number; cy: number }) =>
  boxSvg(
    link,
    CHAIN_BOX_UNITS,
    `<ellipse cx="${link.cx}" cy="${link.cy}" rx="3" ry="4" fill="none" stroke="${CHAIN_STROKE}" stroke-width="1.5"/>`,
  );

const fixedLink = (cx: number, cy: number, rotation: number) =>
  petSvg(
    `<ellipse cx="${cx}" cy="${cy}" rx="3" ry="4" fill="none" stroke="${CHAIN_STROKE}" stroke-width="1.5" transform="rotate(${rotation} ${cx} ${cy})"/>`,
  );

const wingArt = (wing: { cx: number; cy: number }) =>
  boxSvg(
    wing,
    WING_BOX_UNITS,
    `<ellipse cx="${wing.cx}" cy="${wing.cy}" rx="4" ry="3" fill="${WING_FILL}"/>`,
  );

export const chainDragonPet: DecorationSpec = {
  id: 'chainShatter',
  anchor: 'pet',
  nodes: [
    petFloat(FLOAT_MS, [
      { kind: 'svg', art: bodyArt },
      boxLayer(chainSampler(CHAIN_LEFT, 0), CHAIN_LOOP_MS, CHAIN_BOX_UNITS, chainLink(CHAIN_LEFT)),
      { kind: 'svg', art: fixedLink(18, 42, 20) },
      boxLayer(
        chainSampler(CHAIN_RIGHT, 0.4),
        CHAIN_LOOP_MS,
        CHAIN_BOX_UNITS,
        chainLink(CHAIN_RIGHT),
      ),
      { kind: 'svg', art: fixedLink(54, 40, -20) },
      boxLayer(wingSampler(LEFT_WING, 0), WING_LOOP_MS, WING_BOX_UNITS, wingArt(LEFT_WING)),
      boxLayer(wingSampler(RIGHT_WING, 0.6), WING_LOOP_MS, WING_BOX_UNITS, wingArt(RIGHT_WING)),
    ]),
  ],
};
