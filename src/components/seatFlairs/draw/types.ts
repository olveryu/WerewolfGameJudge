/**
 * Flair draw function type definitions.
 *
 * Each flair is described by a FlairDrawConfig: timer durations + a draw function
 * that receives the Canvas context, size, progress values, and optional colors.
 */

export interface FlairColors {
  rgb: string;
  rgbLight: string;
}

export interface FlairDrawConfig {
  /** Animation timer durations in ms. First is primary progress. */
  durations: number[];
  /** Draw one frame. progress[] matches durations[] order, each ∈ [0,1). */
  draw: (
    ctx: CanvasRenderingContext2D,
    size: number,
    progress: [number, ...number[]],
    colors?: FlairColors,
  ) => void;
}
