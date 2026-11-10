/**
 * Mythic collection companions in a 100 × 100 viewBox, confined to the pet box: 天机星梭
 * (astral, fate reweave), 流珠鳐 (ocean, ocean pearl) and 丹青纸鹤 (ink, unfold landscape). The
 * whole pet bobs; the astral orbit turns and the ocean / ink wings beat as path morphs.
 */
import { MYTHIC_COLLECTION_COLORS, type MythicCollection } from '@/config/mythicVisual';
import type { DecorationNode, DecorationSpec, LayerSampler } from '@/scene/decoration';

import { boxLayer, boxSvg, morphPaths, opaqueMorph, petSvg } from './petArt';

const LOOP_MS = 4200;
const WING_VARIANTS = 8;
const VIEWBOX = 100;
const ORBIT_BOX_UNITS = 90;
const ORBIT = { cx: 50, cy: 48 } as const;

function unitsToPx(units: number, size: number): number {
  return (units * size) / VIEWBOX;
}

/** Whole-pet bob: translate(0, sin(t·2π)·4 units). */
const floatSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 + unitsToPx(Math.sin(t * Math.PI * 2) * 4, size),
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

/** Astral orbit: rotate(t·360) about (50, 48). */
const orbitSampler: LayerSampler = (t, size) => ({
  x: unitsToPx(ORBIT.cx, size),
  y: unitsToPx(ORBIT.cy, size),
  rotateDeg: t * 360,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

function wingPath(collection: 'ocean' | 'ink', t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 17;
  return collection === 'ocean'
    ? `M50 34 L34 39 L8 ${23 + lift} Q11 66 34 65 L50 74 L66 65 Q89 66 92 ${23 + lift} L66 39 Z`
    : `M49 60 L8 ${17 + lift} L31 70 L49 75 L91 ${16 - lift} L69 62 Z`;
}

function wingMorph(collection: 'ocean' | 'ink'): DecorationNode {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  return {
    kind: 'morph',
    sample: opaqueMorph,
    durationMs: LOOP_MS,
    variantCount: WING_VARIANTS,
    mode: 'stacked',
    art: morphPaths(
      (k) => [wingPath(collection, k / WING_VARIANTS)],
      collection === 'ocean' ? colors.primary : colors.pearl,
      { color: colors.dark, width: 2 },
      VIEWBOX,
    ),
  };
}

const astral = MYTHIC_COLLECTION_COLORS.astral;
const ocean = MYTHIC_COLLECTION_COLORS.ocean;
const ink = MYTHIC_COLLECTION_COLORS.ink;

const CONTENT: Record<MythicCollection, readonly DecorationNode[]> = {
  astral: [
    {
      kind: 'svg',
      art: petSvg(
        `<ellipse cx="50" cy="48" rx="39" ry="19" fill="none" stroke="${astral.secondary}" stroke-width="3"/>`,
        VIEWBOX,
      ),
    },
    boxLayer(
      orbitSampler,
      LOOP_MS,
      ORBIT_BOX_UNITS,
      boxSvg(
        ORBIT,
        ORBIT_BOX_UNITS,
        `<ellipse cx="50" cy="48" rx="18" ry="39" fill="none" stroke="${astral.primary}" stroke-width="2.5"/>
        <circle cx="50" cy="9" r="4" fill="${astral.pearl}"/>`,
        VIEWBOX,
      ),
      VIEWBOX,
    ),
    {
      kind: 'svg',
      art: petSvg(
        `<path d="M50 9 L67 47 L50 88 L33 47 Z" fill="${astral.dark}" stroke="${astral.secondary}" stroke-width="3"/>
        <path d="M50 26 L54 43 L65 48 L54 52 L50 69 L46 52 L35 48 L46 43 Z" fill="${astral.pearl}"/>`,
        VIEWBOX,
      ),
    },
  ],
  ocean: [
    {
      kind: 'svg',
      art: petSvg(
        `<path d="M50 64 Q82 86 55 94" fill="none" stroke="${ocean.secondary}" stroke-width="3"/>`,
        VIEWBOX,
      ),
    },
    wingMorph('ocean'),
    {
      kind: 'svg',
      art: petSvg(
        `<path d="M50 38 L31 59 Q50 78 69 59 Z" fill="${ocean.pearl}"/>
        <g fill="${ocean.dark}"><circle cx="42" cy="49" r="3"/><circle cx="58" cy="49" r="3"/></g>
        <circle cx="50" cy="29" r="6" fill="${ocean.pearl}" stroke="${ocean.secondary}" stroke-width="2"/>`,
        VIEWBOX,
      ),
    },
  ],
  ink: [
    wingMorph('ink'),
    {
      kind: 'svg',
      art: petSvg(
        `<path d="M45 66 L57 28 L65 24 L82 35 L67 34 L58 73 Z" fill="${ink.dark}" stroke="${ink.primary}" stroke-width="2"/>
        <path d="M58 27 L66 24 L71 28 L64 31 Z M46 73 L42 84 L53 81" fill="${ink.secondary}" stroke="${ink.secondary}" stroke-width="2"/>
        <circle cx="65" cy="30" r="1.5" fill="${ink.pearl}"/>`,
        VIEWBOX,
      ),
    },
  ],
};

function collectionPet(id: string, collection: MythicCollection): DecorationSpec {
  return {
    id,
    anchor: 'pet',
    nodes: [
      {
        kind: 'layer',
        sample: floatSampler,
        durationMs: LOOP_MS,
        box: (size) => ({ width: size, height: size }),
        children: CONTENT[collection],
      },
    ],
  };
}

export const starShuttlePet = collectionPet('fateReweave', 'astral');
export const pearlRayPet = collectionPet('oceanPearl', 'ocean');
export const paintedCranePet = collectionPet('unfoldLandscape', 'ink');
