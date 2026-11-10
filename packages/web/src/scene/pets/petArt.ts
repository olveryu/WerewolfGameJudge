/**
 * Shared building blocks of the seat pets, ported from the previous client's `seatPets`: pets
 * are authored in a 72 × 72 viewBox (the mythic collection ones in 100 × 100), their static
 * artwork stays SVG markup rasterised by the stage, and moving parts are sampled nodes.
 */
import { applyViewBox, svgPath } from '@/scene/art';
import type {
  DecorationNode,
  LayerNode,
  LayerSampler,
  MorphArt,
  MorphSampler,
  SvgArt,
} from '@/scene/decoration';
import { CSS_EASE_IN_OUT } from '@/scene/timeline';

/** Pets are authored in a 72 × 72 viewBox. */
const PET_VIEWBOX = 72;

/** react-native-svg text used the system UI font; rasterised SVG has no page fonts. */
export const PET_TEXT_FONT = 'system-ui, -apple-system, sans-serif';

export function petUnitsToPx(units: number, size: number): number {
  return (units * size) / PET_VIEWBOX;
}

/** Static artwork over the whole pet box (`viewBox` square units). */
export function petSvg(body: string, viewBox = PET_VIEWBOX): SvgArt {
  return (size) => ({ width: size, height: size, viewBox: [0, 0, viewBox, viewBox], body });
}

/** A `boxUnits` square of pet artwork centred on `(cx, cy)`, as loopMotion layer content. */
export function boxSvg(
  centre: { cx: number; cy: number },
  boxUnits: number,
  body: string,
  viewBox = PET_VIEWBOX,
): SvgArt {
  return (size) => {
    const side = (boxUnits * size) / viewBox;
    return {
      width: side,
      height: side,
      viewBox: [centre.cx - boxUnits / 2, centre.cy - boxUnits / 2, boxUnits, boxUnits],
      body,
    };
  };
}

/** A loopMotion layer whose `boxUnits` box is centred on the sampled point. */
export function boxLayer(
  sample: LayerSampler,
  durationMs: number,
  boxUnits: number,
  art: SvgArt,
  viewBox = PET_VIEWBOX,
): LayerNode {
  return {
    kind: 'layer',
    sample,
    durationMs,
    box: (size) => {
      const side = (boxUnits * size) / viewBox;
      return { width: side, height: side };
    },
    children: [{ kind: 'svg', art }],
  };
}

/** Vertical travel of the shared idle bob, in px. */
const FLOAT_RISE = 4;

/**
 * The idle bob most pets sit on (`PetFloat`): a CSS animation from 0 to -4 px, ease-in-out,
 * alternating, half the cycle each way.
 */
const floatSampler: LayerSampler = (t, size) => {
  const phase = t * 2;
  return {
    x: size / 2,
    y: size / 2 - FLOAT_RISE * CSS_EASE_IN_OUT(phase < 1 ? phase : 2 - phase),
    rotateDeg: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
};

export function petFloat(durationMs: number, children: readonly DecorationNode[]): LayerNode {
  return {
    kind: 'layer',
    sample: floatSampler,
    durationMs,
    box: (size) => ({ width: size, height: size }),
    children,
  };
}

/** Morph sampler of pets whose variants carry the motion: always opaque. */
export const opaqueMorph: MorphSampler = () => ({ opacity: 1 });

interface MorphStroke {
  color: string;
  width: number;
  cap?: 'round';
  join?: 'round';
}

/** Morph art drawing variant paths (`paths(k)`) in viewBox units, filled and/or stroked. */
export function morphPaths(
  paths: (k: number) => readonly string[],
  fill: string | null,
  stroke: MorphStroke | null,
  viewBox = PET_VIEWBOX,
): MorphArt {
  return (context, k, size) => {
    const unit = applyViewBox(context, size, viewBox);
    for (const d of paths(k)) {
      context.path(svgPath(d));
      if (fill) context.fill(fill);
      if (stroke) {
        context.stroke({
          color: stroke.color,
          width: stroke.width * unit,
          cap: stroke.cap ?? 'butt',
          join: stroke.join ?? 'miter',
          miterLimit: 4,
        });
      }
    }
  };
}
