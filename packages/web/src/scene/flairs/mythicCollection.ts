/**
 * Mythic collection flairs: scenery at the bottom-left of the seat that leaves the face and the
 * bottom-right companion unobstructed. Star Weave (astral), Moon Tides (ocean), Painted
 * Mountains (ink).
 */
import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_LOOP_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { applyViewBox, flattenPath, strokeDashed, svgPath } from '@/scene/art';
import type {
  DashFlowNode,
  DecorationNode,
  DecorationSpec,
  LayerNode,
  LayerSampler,
  MorphArt,
  MorphSampler,
  StaticArt,
} from '@/scene/decoration';

/** Artwork is authored in a 100 × 100 viewBox. */
const VIEWBOX = 100;

// ── Astral weave: rotating grid seen in floor perspective ─────────────────────
const WEAVE_CX = 34;
const WEAVE_CY = 88;
const WEAVE_SQUASH = 0.24;
/** Grid and diamond reach ±34 units plus stroke. */
const WEAVE_BOX = 74;

const weaveSampler: LayerSampler = (t, size) => {
  const box = (WEAVE_BOX / VIEWBOX) * size;
  return { x: box / 2, y: box / 2, rotateDeg: t * 360, scaleX: 1, scaleY: 1, opacity: 1 };
};

// ── Stars / bubbles / leaves: rise 12 units and fade over the loop ────────────
const STARS_RISE = 12;

const starsSampler: LayerSampler = (t, size) => ({
  x: size / 2,
  y: size / 2 - (t * STARS_RISE * size) / VIEWBOX,
  rotateDeg: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: Math.sin(t * Math.PI),
});

// ── Ocean tide: control points bob ±7 / ∓5 units ──────────────────────────────
const TIDE_VARIANTS = 8;

function tidePath(t: number): string {
  const bob = Math.sin(t * Math.PI * 2);
  return `M5 88 Q17 ${77 + bob * 7} 30 86 T62 86 M7 94 Q25 ${83 - bob * 5} 39 92 T66 90`;
}

const tideSampler: MorphSampler = () => ({ opacity: 1 });

/** The original dash offset travelled 180 viewBox units per loop. */
const FLOW_TRAVEL = 180;

/** A dashed highlight whose dashes slide along `d`. */
function dashedFlow(
  d: string,
  stroke: string,
  strokeWidth: number,
  dash: number,
  gap: number,
): DashFlowNode {
  const polylines = flattenPath(d);
  return {
    kind: 'dashFlow',
    durationMs: MYTHIC_LOOP_DURATION,
    dashPeriod: dash + gap,
    travel: FLOW_TRAVEL,
    art: (context, dashOffset, size) => {
      const unit = applyViewBox(context, size, VIEWBOX);
      strokeDashed(context, polylines, [dash, gap], dashOffset, {
        color: stroke,
        width: strokeWidth * unit,
      });
    },
  };
}

/** Rising art over the whole tile, drawn in viewBox units. */
function risingLayer(art: StaticArt): LayerNode {
  return {
    kind: 'layer',
    sample: starsSampler,
    box: (size) => ({ width: size, height: size }),
    art,
    durationMs: MYTHIC_LOOP_DURATION,
  };
}

function collectionNodes(collection: MythicCollection): DecorationNode[] {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'astral') {
    const weaveArt: StaticArt = (context, size) => {
      const unit = applyViewBox(context, size, VIEWBOX);
      context
        .path(
          svgPath(
            'M-26 -26 H26 V26 H-26 Z M-13 -26 V26 M0 -26 V26 M13 -26 V26 M-26 -13 H26 M-26 0 H26 M-26 13 H26',
          ),
        )
        .stroke({ color: colors.primary, width: 1.5 * unit });
      context
        .path(svgPath('M0 -34 L34 0 L0 34 L-34 0 Z'))
        .stroke({ color: colors.secondary, width: 2 * unit });
    };
    return [
      {
        // Squash outside the rotation so the grid spins as a flat floor seen in perspective.
        kind: 'group',
        place: (size) => {
          const unit = size / VIEWBOX;
          const box = WEAVE_BOX * unit;
          return {
            left: WEAVE_CX * unit - box / 2,
            top: WEAVE_CY * unit - box / 2,
            width: box,
            height: box,
            scaleX: 1,
            scaleY: WEAVE_SQUASH,
          };
        },
        children: [
          {
            kind: 'layer',
            sample: weaveSampler,
            art: weaveArt,
            durationMs: MYTHIC_LOOP_DURATION,
          },
        ],
      },
      risingLayer((context, size) => {
        const unit = applyViewBox(context, size, VIEWBOX);
        context
          .path(svgPath('M15 79 v-7 m-3 3 h6 M34 85 v-9 m-4 4 h8 M54 78 v-6 m-3 3 h6'))
          .stroke({ color: colors.pearl, width: 1.2 * unit });
      }),
    ];
  }
  if (collection === 'ocean') {
    const tideArt: MorphArt = (context, k, size) => {
      const unit = applyViewBox(context, size, VIEWBOX);
      context
        .path(svgPath(tidePath(k / TIDE_VARIANTS)))
        .stroke({ color: colors.primary, width: 2.3 * unit, cap: 'round' });
    };
    return [
      {
        kind: 'morph',
        sample: tideSampler,
        durationMs: MYTHIC_LOOP_DURATION,
        variantCount: TIDE_VARIANTS,
        mode: 'stacked',
        art: tideArt,
      },
      dashedFlow('M5 91 Q20 80 35 89 T66 89', colors.pearl, 1.3, 5, 9),
      risingLayer((context, size) => {
        const unit = applyViewBox(context, size, VIEWBOX);
        context
          .path(
            svgPath('M16 83 a2 2 0 1 0 0 -4 a2 2 0 1 0 0 4 M46 89 a3 3 0 1 0 0 -6 a3 3 0 1 0 0 6'),
          )
          .stroke({ color: colors.secondary, width: unit });
      }),
    ];
  }
  const mountainsArt: StaticArt = (context, size) => {
    const unit = applyViewBox(context, size, VIEWBOX);
    context
      .path(svgPath('M4 92 L16 76 L24 85 L38 69 L48 85 L58 78 L68 93 Z'))
      .fill({ color: colors.dark, alpha: 0.8 });
    context.path(svgPath('M9 92 L21 83 L29 89 L40 79 L54 93 Z')).fill(colors.primary);
    context
      .path(svgPath('M33 78 L38 69 L43 78 M11 83 L16 76 L20 82'))
      .stroke({ color: colors.pearl, width: unit });
  };
  return [
    { kind: 'static', art: mountainsArt },
    dashedFlow('M15 94 Q24 88 35 93 T63 94', colors.pearl, 1.6, 14, 9),
    risingLayer((context, size) => {
      applyViewBox(context, size, VIEWBOX);
      context.path(svgPath('M15 76 l4 -2 l-2 5 Z M51 82 l5 -3 l-2 5 Z')).fill(colors.secondary);
    }),
  ];
}

/** Weaves a low-perspective star grid beneath the avatar. */
export const starWeaveFlair: DecorationSpec = {
  id: 'starWeave',
  nodes: collectionNodes('astral'),
};

/** Receding waves and coral-coloured bubbles. */
export const moonTidesFlair: DecorationSpec = {
  id: 'moonTides',
  nodes: collectionNodes('ocean'),
};

/** Layered ink mountains with a moving river highlight. */
export const paintedMountainsFlair: DecorationSpec = {
  id: 'paintedMountains',
  nodes: collectionNodes('ink'),
};
