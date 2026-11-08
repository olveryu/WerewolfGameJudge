/**
 * Decoration model for the scene layer (docs/web-client-rewrite.md §5.3, §6).
 *
 * A decoration is a list of looping nodes. Each node's motion comes from a pure sampler
 * `(t, size) => geometry`, the same contract as the React Native client's loopMotion samplers,
 * so samplers port verbatim. The stage evaluates samplers every frame; nothing here touches
 * PixiJS display objects.
 */
import type { GraphicsContext } from 'pixi.js';

/** Pure loop sampler: progress `t ∈ [0, 1)` and tile pixel `size` → geometry. */
export type LoopSampler<G> = (t: number, size: number) => G;

/** Filled circle at loop progress `t`, in the tile's pixel space. */
export interface DotFrame {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

/** Placement of a static art layer at loop progress `t`; `(x, y)` is the art's centre. */
export interface LayerFrame {
  x: number;
  y: number;
  rotateDeg: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export type DotSampler = LoopSampler<DotFrame>;
export type LayerSampler = LoopSampler<LayerFrame>;

/** Draws static art centred on the origin for a tile of `size` pixels. */
export type LayerArt = (context: GraphicsContext, size: number) => void;

interface LoopTiming {
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`. */
  phase: number;
}

export interface DotNode extends LoopTiming {
  kind: 'dot';
  sample: DotSampler;
  /** Fill colour as `0xRRGGBB`. */
  color: number;
}

export interface LayerNode extends LoopTiming {
  kind: 'layer';
  sample: LayerSampler;
  /** Module-level function; the stage caches the drawn geometry per `(art, size)`. */
  art: LayerArt;
}

export type DecorationNode = DotNode | LayerNode;

/** A seat decoration: an id for diagnostics plus its nodes, drawn back to front. */
export interface DecorationSpec {
  id: string;
  nodes: readonly DecorationNode[];
}

/**
 * Loop progress for a node at `timeMs`: the RN client shifted elements into the cycle with a
 * negative `animation-delay` of `phase × duration`, which this reproduces.
 */
export function loopProgress(timeMs: number, durationMs: number, phase: number): number {
  const progress = timeMs / durationMs + phase;
  return progress - Math.floor(progress);
}
