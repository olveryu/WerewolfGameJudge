/** 永夜渡鸦 (fate decree reveal): an eternal-night raven beating its silver wing. No idle bob. */
import { MYTHIC_COLORS } from '@/config/mythicVisual';
import type { DecorationSpec } from '@/scene/decoration';

import { morphPaths, opaqueMorph, petSvg } from './petArt';

const LOOP_MS = 4200;
const WING_VARIANTS = 8;
const RAVEN_VIEWBOX = 100;

function wingPath(t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 6;
  return `M53 45 Q32 ${27 - lift} 9 ${21 - lift} L16 ${39 - lift} L22 ${35 - lift} L23 ${48 - lift} L30 ${43 - lift} L33 ${57 - lift} Q45 68 58 57 Z`;
}

function featherPath(t: number): string {
  const lift = Math.sin(t * Math.PI * 2) * 6;
  return `M19 ${31 - lift} L45 52 M27 ${36 - lift} L48 55 M35 ${41 - lift} L51 57`;
}

const wingArt = morphPaths(
  (k) => [wingPath(k / WING_VARIANTS)],
  MYTHIC_COLORS.silver,
  { color: MYTHIC_COLORS.obsidian, width: 2, join: 'round' },
  RAVEN_VIEWBOX,
);

const featherArt = morphPaths(
  (k) => [featherPath(k / WING_VARIANTS)],
  null,
  { color: MYTHIC_COLORS.metal, width: 2 },
  RAVEN_VIEWBOX,
);

const bodyArt = petSvg(
  `<path d="M47 65 L29 87 L41 82 L43 89 L59 69 Z" fill="${MYTHIC_COLORS.metal}" stroke="${MYTHIC_COLORS.obsidian}" stroke-width="2"/>
  <path d="M53 42 Q65 36 72 50 Q75 65 60 73 Q47 77 40 65 Q37 52 53 42 Z" fill="${MYTHIC_COLORS.obsidian}" stroke="${MYTHIC_COLORS.silver}" stroke-width="2"/>`,
  RAVEN_VIEWBOX,
);

const headArt = petSvg(
  `<path d="M55 43 Q52 27 63 23 Q77 20 81 34 L77 49 L67 57 L59 51 Z" fill="${MYTHIC_COLORS.obsidian}" stroke="${MYTHIC_COLORS.silver}" stroke-width="2"/>
  <path d="M79 33 L95 41 L78 43 Z" fill="${MYTHIC_COLORS.metal}" stroke="${MYTHIC_COLORS.obsidian}" stroke-width="2"/>
  <path d="M60 29 Q66 25 73 28 M61 48 L65 54 L69 49 M54 71 L54 79 L48 81 M65 69 L66 77 L72 79" stroke="${MYTHIC_COLORS.silver}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="73" cy="34" r="3.5" fill="${MYTHIC_COLORS.crimson}"/>
  <circle cx="74" cy="33" r="1" fill="${MYTHIC_COLORS.highlight}"/>`,
  RAVEN_VIEWBOX,
);

export const nightRavenPet: DecorationSpec = {
  id: 'fateDecree',
  anchor: 'pet',
  nodes: [
    { kind: 'svg', art: bodyArt },
    {
      kind: 'morph',
      sample: opaqueMorph,
      durationMs: LOOP_MS,
      variantCount: WING_VARIANTS,
      mode: 'stacked',
      art: (context, k, size) => {
        wingArt(context, k, size);
        featherArt(context, k, size);
      },
    },
    { kind: 'svg', art: headArt },
  ],
};
