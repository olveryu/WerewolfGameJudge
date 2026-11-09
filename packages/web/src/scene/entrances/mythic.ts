/**
 * Mythic seat entrances, ports of the previous client's `ThroneArrival` and
 * `MythicCollectionArrivals`: a throne rising behind the seat, and three collection arrivals
 * whose strokes uncover the portrait. Both clip to the tile's rounded corners and run linearly
 * over 2.8 s; their artwork is authored in a 100 × 100 viewBox.
 */
import type { GraphicsContext } from 'pixi.js';

import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_COLORS,
  MYTHIC_ENTRY_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { svgPath } from '@/scene/art';
import { type EntranceSpec, pose } from '@/scene/entrance';
import { Easing, track, withTiming } from '@/scene/timeline';

const VIEWBOX = 100;

const progressTrack = () =>
  track(0, withTiming(1, { duration: MYTHIC_ENTRY_DURATION, easing: Easing.linear }));

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Fills and/or strokes `d` (viewBox units; stroke widths scaled by `unit`). */
function shape(
  context: GraphicsContext,
  d: string,
  unit: number,
  fill: string | null,
  stroke: { color: string; width: number; cap?: 'round' } | null,
): void {
  context.path(svgPath(d));
  if (fill) context.fill(fill);
  if (stroke) {
    context.stroke({
      color: stroke.color,
      width: stroke.width * unit,
      cap: stroke.cap ?? 'butt',
      join: 'miter',
      miterLimit: 4,
    });
  }
}

export function throneArrival(): EntranceSpec {
  const progress = progressTrack();
  return {
    id: 'throneArrival',
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'rounded',
    avatar: (ms, size) => {
      const p = progress.at(ms);
      const rise = Math.min(1, p * 1.5);
      return [
        pose({
          opacity: clamp01((p - 0.4) / 0.35),
          translateY: (1 - rise) * size * 0.15,
          scale: 0.9 + rise * 0.1,
        }),
      ];
    },
    beneath: {
      groupOpacity: (ms) => {
        const p = progress.at(ms);
        return Math.min(1, p * 5) * (1 - Math.max(0, (p - 0.65) / 0.35));
      },
      draw: (context, ms, size) => {
        const p = progress.at(ms);
        const unit = size / VIEWBOX;
        context.setTransform(unit, 0, 0, unit, 0, size * 0.4 * (1 - Math.min(1, p / 0.4)));
        shape(context, 'M16 94 L23 84 H77 L84 94 Z', unit, MYTHIC_COLORS.metal, null);
        shape(context, 'M29 75 V27 Q29 15 50 5 Q71 15 71 27 V75 Z', unit, MYTHIC_COLORS.obsidian, {
          color: MYTHIC_COLORS.silver,
          width: 2.5,
        });
        shape(
          context,
          'M35 67 V29 Q35 22 50 13 Q65 22 65 29 V67 Z',
          unit,
          MYTHIC_COLORS.enamel,
          null,
        );
        shape(context, 'M50 16 V64 M37 30 L63 50 M63 30 L37 50', unit, null, {
          color: MYTHIC_COLORS.crimson,
          width: 1.5,
        });
        shape(context, 'M21 53 H30 V75 H70 V53 H79 V85 H21 Z', unit, MYTHIC_COLORS.obsidian, {
          color: MYTHIC_COLORS.silver,
          width: 2,
        });
        shape(context, 'M30 69 H70 L74 76 H26 Z', unit, MYTHIC_COLORS.crimson, {
          color: MYTHIC_COLORS.silver,
          width: 1.5,
        });
        shape(context, 'M24 85 V90 M76 85 V90 M23 55 H29 M71 55 H77', unit, null, {
          color: MYTHIC_COLORS.pearl,
          width: 3,
        });
        context.resetTransform();
      },
    },
  };
}

function collectionStroke(
  collection: MythicCollection,
  formed: number,
): { d: string; width: number } {
  const f = formed * 100;
  if (collection === 'astral') {
    return { d: `M${f} 0 V100 M0 20 H${f} M0 40 H${f} M0 60 H${f} M0 80 H${f}`, width: 1.5 };
  }
  if (collection === 'ocean') {
    return { d: `M0 ${100 - f} Q25 ${85 - f} 50 ${100 - f} T100 ${100 - f}`, width: 5 };
  }
  const x = formed * 110;
  return { d: `M${x - 5} -10 L${x - 15} 28 L${x + 4} 52 L${x - 10} 78 L${x} 110`, width: 15 };
}

function collectionArrival(id: string, collection: MythicCollection): EntranceSpec {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const progress = progressTrack();
  const formedAt = (ms: number) => clamp01((progress.at(ms) - 0.15) / 0.65);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'rounded',
    avatar: (ms) => {
      const hidden = 1 - formedAt(ms);
      return [collection === 'ocean' ? pose({ clipTop: hidden }) : pose({ clipRight: hidden })];
    },
    above: {
      groupOpacity: (ms) => {
        const p = progress.at(ms);
        return Math.min(1, p * 6) * (1 - Math.max(0, (p - 0.7) / 0.3));
      },
      draw: (context, ms, size) => {
        const unit = size / VIEWBOX;
        context.setTransform(unit, 0, 0, unit, 0, 0);
        const stroke = collectionStroke(collection, formedAt(ms));
        shape(context, stroke.d, unit, null, {
          color: colors.primary,
          width: stroke.width,
          cap: 'round',
        });
        if (collection === 'astral') {
          shape(context, 'M10 0 V100 M30 0 V100 M50 0 V100 M70 0 V100 M90 0 V100', unit, null, {
            color: colors.secondary,
            width: 0.7,
          });
        } else if (collection === 'ocean') {
          shape(context, 'M5 94 Q25 78 45 92 T96 90 M10 84 Q30 73 50 82 T93 83', unit, null, {
            color: colors.pearl,
            width: 1.5,
          });
        } else {
          // Even-odd seal: an outlined square.
          context.rect(80, 8, 14, 18).fill(colors.secondary);
          context.rect(84, 12, 6, 10).cut();
        }
        context.resetTransform();
      },
    },
  };
}

export const wovenArrival = (): EntranceSpec => collectionArrival('wovenArrival', 'astral');
export const tidalArrival = (): EntranceSpec => collectionArrival('tidalArrival', 'ocean');
export const inkArrival = (): EntranceSpec => collectionArrival('inkArrival', 'ink');
