/**
 * Decoration model for the scene layer (docs/web-client-rewrite.md §5.3, §6).
 *
 * A decoration is a tree of looping nodes, one kind per primitive of the React Native client's
 * loopMotion (`LoopDot`, `LoopLine`, `LoopRing`, `LoopPath`, `LoopLayer`, `LoopMorph`,
 * `LoopDashFlow`) plus static art (PixiJS geometry or rasterised SVG) and static groups. Motion
 * comes from pure samplers `(t, size) => geometry` with the same contract as loopMotion, so
 * samplers port verbatim. The stage evaluates samplers every frame; nothing here touches PixiJS
 * display objects.
 */
import type { GraphicsContext } from 'pixi.js';

/** Pure loop sampler: progress `t ∈ [0, 1)` and tile pixel `size` → geometry. */
export type LoopSampler<G> = (t: number, size: number) => G;

/** A colour PixiJS parses: `0xRRGGBB`, `#rrggbb` or a CSS `rgb()` / `rgba()` string. */
export type SceneColor = number | string;

/** Filled circle at loop progress `t`, in the tile's pixel space. */
export interface DotFrame {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

/** Round-capped segment at loop progress `t`, in the tile's pixel space. */
export interface LineFrame {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  opacity: number;
}

/** Stroked circle at loop progress `t`, in the tile's pixel space. */
export interface RingFrame {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
}

/** Stroke state of a fixed path at loop progress `t`. */
export interface PathFrame {
  strokeWidth: number;
  opacity: number;
}

/** Placement of a layer at loop progress `t`; `(x, y)` is the layer's centre. */
export interface LayerFrame {
  x: number;
  y: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

/** Base opacity of a morph at loop progress `t`; variant windows multiply into it. */
export interface MorphFrame {
  opacity: number;
}

export type DotSampler = LoopSampler<DotFrame>;
export type LineSampler = LoopSampler<LineFrame>;
export type RingSampler = LoopSampler<RingFrame>;
export type PathSampler = LoopSampler<PathFrame>;
export type LayerSampler = LoopSampler<LayerFrame>;
export type MorphSampler = LoopSampler<MorphFrame>;

/**
 * Draws static art for a tile of `size` pixels. Art functions are module-level (or built once
 * per spec): the stage caches the drawn geometry per `(art, size)`.
 */
export type StaticArt = (context: GraphicsContext, size: number) => void;
/** Draws a path whose stroke width the stage chooses (the thinnest or thickest sampled). */
export type PathArt = (context: GraphicsContext, strokeWidth: number, size: number) => void;
/** Draws morph variant `k` (the shape at cycle phase `k / variantCount`). */
export type MorphArt = (context: GraphicsContext, k: number, size: number) => void;
/** Draws the dashed stroke(s) with the dash pattern shifted by `dashOffset` (SVG semantics). */
export type DashArt = (context: GraphicsContext, dashOffset: number, size: number) => void;

/** Edge lengths of a layer's box, in px. */
export interface BoxSize {
  width: number;
  height: number;
}

interface LoopTiming {
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
}

export interface DotNode extends LoopTiming {
  kind: 'dot';
  sample: DotSampler;
  color: SceneColor;
}

export interface LineNode extends LoopTiming {
  kind: 'line';
  sample: LineSampler;
  color: SceneColor;
}

/**
 * A ring is a stroked circle of the largest sampled radius scaled to the sampled radius (the
 * stroke scales with it, as in loopMotion). A varying stroke width is drawn as the thinnest and
 * thickest ring with complementary opacity weights.
 */
export interface RingNode extends LoopTiming {
  kind: 'ring';
  sample: RingSampler;
  color: SceneColor;
}

/** A fixed path; the sampler drives only its opacity and stroke width (see `RingNode`). */
export interface PathNode extends LoopTiming {
  kind: 'path';
  sample: PathSampler;
  art: PathArt;
}

/**
 * Content moved by a sampler. Without `box` the content is drawn centred on the layer origin;
 * with `box` it is drawn in box coordinates (origin at the box's top-left) and the box centre
 * sits at the sampled `(x, y)`, like loopMotion's `LoopLayer` `width × height` box.
 */
export interface LayerNode extends LoopTiming {
  kind: 'layer';
  sample: LayerSampler;
  box?: (size: number) => BoxSize;
  art?: StaticArt;
  /** Nested nodes drawn above `art`, in the layer's content coordinates. */
  children?: readonly DecorationNode[];
}

export type MorphMode = 'crossfade' | 'stacked' | 'step';

/**
 * A shape whose geometry changes over the loop, drawn as `variantCount` static variants whose
 * opacities follow windows around their own phase (see `windowWeight`).
 */
export interface MorphNode extends LoopTiming {
  kind: 'morph';
  sample: MorphSampler;
  variantCount: number;
  mode: MorphMode;
  /** Integer number of variant cycles per loop; defaults to 1. */
  cyclesPerLoop?: number;
  art: MorphArt;
}

/**
 * A dashed stroke whose dashes slide along their path: `variantCount` copies at successive dash
 * offsets blended as a stacked morph, cycling `round(travel / dashPeriod)` times per loop.
 */
export interface DashFlowNode extends LoopTiming {
  kind: 'dashFlow';
  /** `dash + gap` of the dash pattern, in the art's units. */
  dashPeriod: number;
  /** Distance the dashes travel per loop, in the art's units. */
  travel: number;
  /** Copies per period; defaults to 12. */
  variantCount?: number;
  /** Opacity envelope; defaults to fully opaque. */
  sample?: MorphSampler;
  art: DashArt;
}

/** Static art in the parent's coordinates. */
export interface StaticNode {
  kind: 'static';
  art: StaticArt;
}

/** SVG artwork drawn over a `width × height` px box at `(0, 0)` in the parent's coordinates. */
export interface SvgArtwork {
  width: number;
  height: number;
  /** `[minX, minY, width, height]` of the user space mapped onto the box. */
  viewBox: readonly [number, number, number, number];
  /** Markup inside the root `<svg>` element. */
  body: string;
}

/**
 * Builds the artwork for a tile of `size` pixels. Module-level (or built once per spec): the
 * stage caches its texture per `(art, size, resolution)`.
 */
export type SvgArt = (size: number) => SvgArtwork;

/**
 * Static SVG artwork that the browser rasterises into a texture at the stage's device-pixel size,
 * so gradients, group opacity and dashes keep full SVG fidelity. The decoration stays hidden
 * until every texture is ready; a rasterisation failure is reported, never skipped.
 */
export interface SvgNode {
  kind: 'svg';
  art: SvgArt;
}

/**
 * Static transform around nested nodes, like a transformed RN `View` box: the box sits at
 * `(left, top)` in the parent's coordinates and is scaled about its centre. `clip` hides content
 * outside the box (`overflow: hidden`).
 */
export interface GroupNode {
  kind: 'group';
  place: (size: number) => {
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
  };
  clip?: boolean;
  children: readonly DecorationNode[];
}

export type DecorationNode =
  | DotNode
  | LineNode
  | RingNode
  | PathNode
  | LayerNode
  | MorphNode
  | DashFlowNode
  | StaticNode
  | SvgNode
  | GroupNode;

/**
 * Where a decoration's square sits on its seat tile:
 * - `tile` (default): from the tile's padding edge, spanning the tile's outer size (flairs).
 * - `avatarFrame`: the avatar frame box. A framed seat's avatar fills the tile's border box, and
 *   frame artwork overflows it by `AVATAR_FRAME_OVERFLOW` of its side on every edge.
 * - `pet`: the seat companion's box at the tile's top-right corner, sized from the grid cell
 *   (`PET_CELL_FRACTION`) and pushed out of the padding box by `PET_CELL_OFFSET` of the cell.
 */
export type DecorationAnchor = 'tile' | 'avatarFrame' | 'pet';

/** Frame overflow per edge as a fraction of the avatar side (viewBox `-8 -8 116 116`). */
export const AVATAR_FRAME_OVERFLOW = 0.08;

/** Pet side as a fraction of the grid cell (the previous tile's `tileSize`), rounded to px. */
export const PET_CELL_FRACTION = 0.32;
/** Pet overhang past the padding box's top and right edges, as a fraction of the cell. */
export const PET_CELL_OFFSET = 0.1;

/** A seat decoration: an id for diagnostics plus its nodes, drawn back to front. */
export interface DecorationSpec {
  id: string;
  anchor?: DecorationAnchor;
  nodes: readonly DecorationNode[];
}
