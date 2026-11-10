/** Mythic silver blade-wing frame (永夜王冠). Artwork stays inside the eight-unit overflow box. */
import { MYTHIC_COLORS, MYTHIC_LOOP_DURATION } from '@/config/mythicVisual';
import { flattenPath, strokeDashed } from '@/scene/art';
import type {
  DecorationNode,
  DecorationSpec,
  LayerNode,
  LayerSampler,
  MorphSampler,
} from '@/scene/decoration';

import { frameSvg } from './frameArt';
import { applyFrameViewBox, FRAME_VIEWBOX_SIZE } from './frameBox';
import { perimeterSweepNodes, type SweepSampler } from './perimeterSweep';

const WING_PATH = 'M1 78 L-3 54 L-2 30 L-5 8 L17 1 H36 M99 78 L103 54 L102 30 L105 8 L83 1 H64';
const ENERGY_DASH = 14;
const ENERGY_GAP = 28;
const ENERGY_TRAVEL = 280;
const RELEASE_DASH = 55;
const RELEASE_TRAVEL = 400;

/** Wings breathe in width about the frame centre. */
const wingsSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 0.94 + Math.sin(t * Math.PI) * 0.06,
  scaleY: 1,
  opacity: 1,
});

/** Energy runs up the wings for the first 65 % of the loop. */
const energySampler: MorphSampler = (t) => ({
  opacity: Math.sin(Math.min(t / 0.65, 1) * Math.PI) * 0.9,
});

/** Crown lifts up to two units and settles. */
const crownSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 - ((5 + Math.sin(t * Math.PI) * 2) * size) / FRAME_VIEWBOX_SIZE,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const crystalSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 0.25 + Math.pow(Math.sin(t * Math.PI), 4) * 0.75,
});

/** Perimeter highlight released by the crown during the second half of the loop. */
const releaseSampler: SweepSampler = (t) => {
  const phase = Math.max(0, (t - 0.5) * 2);
  return { arcLength: phase * RELEASE_TRAVEL + RELEASE_DASH, opacity: Math.sin(phase * Math.PI) };
};

function wingGradient(id: string): string {
  return `
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${MYTHIC_COLORS.metal}"/>
        <stop offset="0.3" stop-color="${MYTHIC_COLORS.pearl}"/>
        <stop offset="0.6" stop-color="${MYTHIC_COLORS.metal}"/>
        <stop offset="1" stop-color="${MYTHIC_COLORS.silver}"/>
      </linearGradient>
    </defs>`;
}

/** Silver crown and crimson crystal, drawn in a 100 × 70 area. */
const NIGHT_CROWN_MOTIF = `
  <g stroke-linejoin="round">
    <path d="M12 57 L1 19 L29 36 L33 16 L50 1 L67 16 L71 36 L99 19 L88 57 L50 69 Z" fill="${MYTHIC_COLORS.obsidian}" stroke="${MYTHIC_COLORS.silver}" stroke-width="2"/>
    <path d="M12 57 L1 19 L24 45 L33 16 L50 1 L40 39 L50 52 L60 39 L50 1 L67 16 L76 45 L99 19 L88 57 L50 69 Z" fill="${MYTHIC_COLORS.silver}"/>
    <path d="M12 57 L50 61 L88 57 M33 16 L24 45 M67 16 L76 45" fill="none" stroke="${MYTHIC_COLORS.pearl}"/>
    <path d="M50 28 L58 43 L50 59 L42 43 Z" fill="${MYTHIC_COLORS.enamel}" stroke="${MYTHIC_COLORS.highlight}"/>
    <path d="M50 28 L58 43 L50 48 Z" fill="${MYTHIC_COLORS.crystal}"/>
  </g>`;

const CROWN_PLACEMENT = 'translate(32 0) scale(.36 .26)';

const wingPolylines = flattenPath(WING_PATH);

/** A layer over the whole frame box. */
function frameLayer(sample: LayerSampler, children: readonly DecorationNode[]): LayerNode {
  return {
    kind: 'layer',
    sample,
    durationMs: MYTHIC_LOOP_DURATION,
    box: (size) => ({ width: size, height: size }),
    children,
  };
}

const crystalLayer = (markup: string): LayerNode =>
  frameLayer(crystalSampler, [{ kind: 'svg', art: frameSvg(() => markup) }]);

/** Coordinates wing movement, ascending energy and a crown-triggered perimeter highlight. */
export const eternalCrownFrame: DecorationSpec = {
  id: 'eternalCrown',
  anchor: 'avatarFrame',
  nodes: [
    {
      kind: 'svg',
      art: frameSvg(
        ({ rx }) => `${wingGradient('frame')}
    <rect x="0" y="0" width="100" height="100" rx="${rx}" fill="none" stroke="url(#frame)" stroke-width="2.4"/>
    <rect x="-2" y="-2" width="104" height="104" rx="${rx + 2}" fill="none" stroke="${MYTHIC_COLORS.crimson}" stroke-width="0.6"/>
  `,
      ),
    },
    ...perimeterSweepNodes({
      durationMs: MYTHIC_LOOP_DURATION,
      sample: releaseSampler,
      dashLength: RELEASE_DASH,
      color: MYTHIC_COLORS.pearl,
      strokeWidth: 2,
    }),
    frameLayer(wingsSampler, [
      {
        kind: 'svg',
        art: frameSvg(
          () => `${wingGradient('wing')}
    <g fill="${MYTHIC_COLORS.obsidian}" stroke="url(#wing)" stroke-width="0.9">
      <path d="M3 13 L-7 4 L-4 28 L-8 23 L-4 48 L-7 44 L-3 75 L4 92 L1 63 L3 42 L-1 22 Z"/>
      <path d="M97 13 L107 4 L104 28 L108 23 L104 48 L107 44 L103 75 L96 92 L99 63 L97 42 L101 22 Z"/>
    </g>
    <g fill="url(#wing)">
      <path d="M-7 4 L-1 27 L-2 48 L1 77 L-4 58 L-5 27 Z"/>
      <path d="M107 4 L101 27 L102 48 L99 77 L104 58 L105 27 Z"/>
    </g>
    <path d="${WING_PATH}" fill="none" stroke="${MYTHIC_COLORS.enamel}" stroke-width="1.8"/>
  `,
        ),
      },
      {
        kind: 'dashFlow',
        durationMs: MYTHIC_LOOP_DURATION,
        dashPeriod: ENERGY_DASH + ENERGY_GAP,
        travel: ENERGY_TRAVEL,
        sample: energySampler,
        art: (context, dashOffset, size) => {
          const unit = applyFrameViewBox(context, size);
          strokeDashed(context, wingPolylines, [ENERGY_DASH, ENERGY_GAP], dashOffset, {
            color: MYTHIC_COLORS.crystal,
            width: 1.8 * unit,
            cap: 'round',
          });
        },
      },
    ]),
    frameLayer(crownSampler, [
      {
        kind: 'svg',
        art: frameSvg(() => `<g transform="${CROWN_PLACEMENT}">${NIGHT_CROWN_MOTIF}</g>`),
      },
      crystalLayer(`
    <g transform="${CROWN_PLACEMENT}">
      <path d="M50 28 L58 43 L50 59 L42 43 Z" fill="${MYTHIC_COLORS.highlight}" stroke="${MYTHIC_COLORS.pearl}" stroke-width="2"/>
    </g>`),
    ]),
    {
      kind: 'svg',
      art: frameSvg(
        () => `
    <path d="M33 100 L43 98 L50 103 L57 98 L67 100 L50 108 Z" fill="${MYTHIC_COLORS.obsidian}" stroke="${MYTHIC_COLORS.silver}"/>
    <path d="M50 96 L54 102 L50 107 L46 102 Z" fill="${MYTHIC_COLORS.enamel}" stroke="${MYTHIC_COLORS.highlight}" stroke-width="0.5"/>
  `,
      ),
    },
    crystalLayer(`<path d="M50 96 L54 102 L50 104 Z" fill="${MYTHIC_COLORS.crystal}"/>`),
  ],
};
