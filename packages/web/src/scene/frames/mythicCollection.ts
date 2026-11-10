/**
 * Mythic collection frames (周天仪, 潮生珊瑚, 游龙飞白); artwork stays inside the eight-unit
 * overflow box.
 */
import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { flattenPath, strokeDashed } from '@/scene/art';
import type { DecorationNode, DecorationSpec, LayerSampler, SvgArt } from '@/scene/decoration';

import { frameSvg } from './frameArt';
import { applyFrameViewBox, frameUnitsToPx } from './frameBox';
import { perimeterSweepNodes, type SweepSampler } from './perimeterSweep';

/** The four edge groups are the top-edge artwork rotated about the frame centre. */
const EDGE_ROTATIONS = [0, 90, 180, 270] as const;
const CORNERS = [
  [7, 7],
  [93, 7],
  [7, 93],
  [93, 93],
] as const;

const CURRENT_DASH = 14;
const CURRENT_GAP = 9;
const CURRENT_TRAVEL = 400;
const PERIMETER_DASH = 24;
const PERIMETER_GAP = 176;
const PERIMETER_TRAVEL = 400;

/** Top-edge mechanism centre `(50, 0)` rotated about `(50, 50)` for each edge. */
const MECHANISM_CENTRES: readonly { x: number; y: number }[] = [
  { x: 50, y: 0 },
  { x: 100, y: 50 },
  { x: 50, y: 100 },
  { x: 0, y: 50 },
];
/** Mechanism artwork spans ±7 units plus stroke. */
const MECHANISM_BOX = 18;

/** Unit vector of the top edge's +x direction after each edge rotation. */
const WAVE_DIRECTIONS: readonly { x: number; y: number }[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

const MECHANISM_SAMPLERS: readonly LayerSampler[] = MECHANISM_CENTRES.map(
  (centre) => (t, size) => ({
    x: frameUnitsToPx(centre.x, size),
    y: frameUnitsToPx(centre.y, size),
    rotateDeg: t * 360,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  }),
);

const WAVE_SAMPLERS: readonly LayerSampler[] = WAVE_DIRECTIONS.map((dir) => (t, size) => {
  const shift = frameUnitsToPx(Math.sin(t * Math.PI * 2) * 3, size) - frameUnitsToPx(0, size);
  return {
    x: size / 2 + dir.x * shift,
    y: size / 2 + dir.y * shift,
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
});

const shimmerSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 0.25 + Math.sin(t * Math.PI * 2) ** 2 * 0.75,
});

const perimeterCurrentSampler: SweepSampler = (t) => ({
  arcLength: t * PERIMETER_TRAVEL + PERIMETER_DASH,
  opacity: 1,
});

const fullBox = (size: number) => ({ width: size, height: size });

/** `markup` once per edge, rotated about the frame centre. */
function aroundEdges(markup: string): string {
  return EDGE_ROTATIONS.map(
    (rotation) => `
    <g transform="rotate(${rotation} 50 50)">${markup}
    </g>`,
  ).join('');
}

function gradient(id: string, collection: MythicCollection): string {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  return `
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.pearl}"/>
        <stop offset=".25" stop-color="${colors.secondary}"/>
        <stop offset=".5" stop-color="${colors.dark}"/>
        <stop offset=".75" stop-color="${colors.pearl}"/>
        <stop offset="1" stop-color="${colors.primary}"/>
      </linearGradient>
    </defs>`;
}

function edgeMarkup(collection: MythicCollection): string {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'astral') {
    return `
      <path d="M17 0 L24 -5 H76 L83 0 L67 -1 H33 Z" fill="${colors.dark}" stroke="${colors.secondary}"/>
      <path d="M28 -2 V-5 M36 -2 V-5 M64 -2 V-5 M72 -2 V-5" stroke="${colors.primary}"/>`;
  }
  if (collection === 'ocean') {
    return `
      <path d="M20 1 L24 -3 L22 -7 M24 -3 L30 -5 M38 1 L40 -4 L37 -6 M40 -4 L45 -7 M63 1 L67 -4 L65 -7 M67 -4 L72 -6 M79 1 L81 -3 L79 -7" fill="none" stroke="${colors.secondary}" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  return `
      <path d="M14 1 L26 -5 L54 -3 L83 -6 L75 1 L44 -1 Z" fill="${colors.dark}"/>`;
}

function cornerMarkup(collection: MythicCollection): string {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'ocean') {
    return `
      <circle r="5.5" fill="${colors.dark}" stroke="${colors.secondary}"/>
      <circle r="3.8" fill="url(#corner)"/>`;
  }
  if (collection === 'astral') {
    return `
      <path d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="${colors.dark}" stroke="${colors.secondary}"/>`;
  }
  return `
      <path d="M-5 4 V-5 H4 M1 -2 V3 H5" fill="none" stroke="${colors.pearl}" stroke-width="1.6"/>`;
}

/** Polylines of `d` once per edge rotation, for dashing with PixiJS. */
function rotatedPolylines(d: string): { points: number[]; closed: boolean }[] {
  return EDGE_ROTATIONS.flatMap((rotation) => {
    const angle = (rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return flattenPath(d).map(({ points, closed }) => {
      const rotated: number[] = [];
      for (let i = 0; i + 1 < points.length; i += 2) {
        const dx = points[i]! - 50;
        const dy = points[i + 1]! - 50;
        rotated.push(50 + dx * cos - dy * sin, 50 + dx * sin + dy * cos);
      }
      return { points: rotated, closed };
    });
  });
}

function animatedNodes(collection: MythicCollection): DecorationNode[] {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'astral') {
    const mechanism = mechanismSvg(
      `
    <path d="M0 -7 V7 M-7 0 H7 M-5 -5 L5 5 M-5 5 L5 -5" stroke="${colors.secondary}" stroke-width="1.5"/>
    <circle cx="0" cy="0" r="3" fill="${colors.pearl}"/>
  `,
    );
    return MECHANISM_SAMPLERS.map((sample) => ({
      kind: 'layer',
      sample,
      durationMs: MYTHIC_LOOP_DURATION,
      box: (size) => {
        const side = frameUnitsToPx(MECHANISM_BOX, size) - frameUnitsToPx(0, size);
        return { width: side, height: side };
      },
      children: [{ kind: 'svg', art: mechanism }],
    }));
  }
  if (collection === 'ocean') {
    return EDGE_ROTATIONS.map((rotation, i) => ({
      kind: 'layer',
      sample: WAVE_SAMPLERS[i]!,
      durationMs: MYTHIC_LOOP_DURATION,
      box: fullBox,
      children: [
        {
          kind: 'svg',
          art: frameSvg(
            () => `
    <g transform="rotate(${rotation} 50 50)">
      <path d="M17 -1 Q27 -7 37 -2 T57 -2 T77 -2" fill="none" stroke="${colors.primary}" stroke-width="1.5"/>
    </g>
  `,
          ),
        },
      ],
    }));
  }
  const currents = rotatedPolylines('M18 -1 L40 -3 L80 -4 M23 -3 L47 -1 L76 -5');
  return [
    {
      kind: 'dashFlow',
      durationMs: MYTHIC_LOOP_DURATION,
      dashPeriod: CURRENT_DASH + CURRENT_GAP,
      travel: CURRENT_TRAVEL,
      art: (context, dashOffset, size) => {
        const unit = applyFrameViewBox(context, size);
        strokeDashed(context, currents, [CURRENT_DASH, CURRENT_GAP], dashOffset, {
          color: colors.pearl,
          width: 0.8 * unit,
        });
      },
    },
    {
      kind: 'svg',
      art: frameSvg(
        () => `${aroundEdges(`
      <path d="M44 -6 H55 V5 H44 Z M47 -3 V2 H52 V-3 Z" fill="${colors.secondary}" fill-rule="evenodd"/>`)}
  `,
      ),
    },
  ];
}

/** Mechanism artwork in its own `MECHANISM_BOX` square viewBox, centred on the origin. */
function mechanismSvg(body: string): SvgArt {
  return (size) => {
    const side = frameUnitsToPx(MECHANISM_BOX, size) - frameUnitsToPx(0, size);
    return {
      width: side,
      height: side,
      viewBox: [-MECHANISM_BOX / 2, -MECHANISM_BOX / 2, MECHANISM_BOX, MECHANISM_BOX],
      body,
    };
  };
}

function collectionFrame(id: string, collection: MythicCollection): DecorationSpec {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  return {
    id,
    anchor: 'avatarFrame',
    nodes: [
      {
        kind: 'svg',
        art: frameSvg(
          ({ rx }) => `${gradient('border', collection)}
    <rect width="100" height="100" rx="${rx}" fill="none" stroke="${colors.dark}" stroke-width="5"/>
    <rect width="100" height="100" rx="${rx}" fill="none" stroke="url(#border)" stroke-width="3"/>
    <rect x="3" y="3" width="94" height="94" rx="${Math.max(0, rx - 3)}" fill="none" stroke="${colors.primary}" stroke-width="0.6"/>${aroundEdges(edgeMarkup(collection))}
  `,
        ),
      },
      ...animatedNodes(collection),
      {
        kind: 'svg',
        art: frameSvg(
          () => `${gradient('corner', collection)}${CORNERS.map(
            ([horizontal, vertical]) => `
    <g transform="translate(${horizontal} ${vertical})">${cornerMarkup(collection)}
    </g>`,
          ).join('')}
  `,
        ),
      },
      {
        kind: 'layer',
        sample: shimmerSampler,
        durationMs: MYTHIC_LOOP_DURATION,
        box: fullBox,
        children: [
          {
            kind: 'svg',
            art: frameSvg(() =>
              CORNERS.map(
                ([horizontal, vertical]) => `
    <path d="M0 -3 L1 -1 L3 0 L1 1 L0 3 L-1 1 L-3 0 L-1 -1 Z" fill="${colors.primary}" transform="translate(${horizontal} ${vertical})"/>`,
              ).join(''),
            ),
          },
        ],
      },
      ...perimeterSweepNodes({
        durationMs: MYTHIC_LOOP_DURATION,
        sample: perimeterCurrentSampler,
        dashLength: PERIMETER_DASH,
        dashCount: 2,
        dashSpacing: PERIMETER_DASH + PERIMETER_GAP,
        color: colors.pearl,
        strokeWidth: 1.5,
      }),
    ],
  };
}

/** Gold star mechanisms assembled around a fixed square aperture. */
export const celestialLoomFrame = collectionFrame('celestialLoom', 'astral');
/** Coral and nacre frame with travelling tidal light. */
export const coralTideFrame = collectionFrame('coralTide', 'ocean');
/** Jade and ink frame with moving dry-brush highlights. */
export const inkLandscapeFrame = collectionFrame('inkLandscape', 'ink');
